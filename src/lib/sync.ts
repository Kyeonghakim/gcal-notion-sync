import { listCalendars, getCalendarEvents } from './google-calendar';
import { NotionClient } from './notion';
import { NOTION_SYNC_PROPS } from '../types/notion';
import { CalendarEvent } from '../types/calendar';
import pLimit from 'p-limit';

export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  skipped: number;
  errors: Array<{ eventId: string; error: string }>;
  calendarErrors: Array<{ calendarId: string; error: string }>;
}

function normalizeDateTime(dt: string | undefined): string {
  if (!dt) return '';
  const d = new Date(dt);
  return isNaN(d.getTime()) ? dt : d.toISOString();
}

function hasEventChanged(page: any, event: CalendarEvent, calendarName: string): boolean {
  const props = page.properties;
  
  const titleProp = props['title'] || props['ToDo'];
  const currentTitle = titleProp?.title?.[0]?.plain_text || '';
  if (currentTitle !== (event.summary || '(No Title)')) return true;
  
  const calProp = props[NOTION_SYNC_PROPS.CALENDAR_NAME];
  const currentCal = calProp?.rich_text?.[0]?.plain_text || '';
  if (currentCal !== calendarName) return true;
  
  const dateProp = props['데드라인'];
  const currentStart = normalizeDateTime(dateProp?.date?.start);
  const eventStart = normalizeDateTime(event.start.dateTime || event.start.date);
  if (currentStart !== eventStart) return true;
  
  return false;
}

export async function syncCalendarEvents(): Promise<SyncResult> {
  const NOTION_KEY = process.env.NOTION_KEY?.trim();
  const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID?.trim();
  const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID?.trim();

  if (!NOTION_KEY || !NOTION_DATABASE_ID) {
    throw new Error('Missing NOTION_KEY or NOTION_DATABASE_ID');
  }

  const notion = new NotionClient(NOTION_KEY);
  const result: SyncResult = { added: 0, updated: 0, deleted: 0, skipped: 0, errors: [], calendarErrors: [] };

  try {
    await notion.ensureSyncProperties(NOTION_DATABASE_ID);
  } catch (e) {
    throw new Error(`Failed to ensure Notion sync properties: ${(e as Error).message}`);
  }

  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(now.getDate() - 30);
  const timeMax = new Date(now);
  timeMax.setDate(now.getDate() + 90);

  const allGoogleEvents: { event: CalendarEvent; calendarName: string }[] = [];

  if (GOOGLE_CALENDAR_ID) {
    try {
      const events = await getCalendarEvents(GOOGLE_CALENDAR_ID, timeMin, timeMax);
      events.forEach((event) => {
        if (event.status !== 'cancelled') {
          allGoogleEvents.push({ event, calendarName: GOOGLE_CALENDAR_ID });
        }
      });
    } catch (e) {
      result.calendarErrors.push({ calendarId: GOOGLE_CALENDAR_ID, error: (e as Error).message });
      console.error(`Failed to fetch events for calendar ${GOOGLE_CALENDAR_ID}`, e);
    }
  }

  let calendars: Awaited<ReturnType<typeof listCalendars>> = [];
  try {
    calendars = await listCalendars();
  } catch (e) {
    result.calendarErrors.push({ calendarId: 'listCalendars', error: (e as Error).message });
    console.error('Failed to list calendars', e);
  }

  for (const calendar of calendars) {
    if (calendar.id === GOOGLE_CALENDAR_ID) continue;
    try {
      const events = await getCalendarEvents(calendar.id, timeMin, timeMax);
      events.forEach((event) => {
        if (event.status !== 'cancelled') {
          allGoogleEvents.push({ event, calendarName: calendar.summary });
        }
      });
    } catch (e) {
      result.calendarErrors.push({ calendarId: calendar.id, error: (e as Error).message });
      console.error(`Failed to fetch events for calendar ${calendar.summary}`, e);
    }
  }

  const existingPages = await notion.getSyncedPages(NOTION_DATABASE_ID);
  const notionPageMap = new Map<string, any>();

  existingPages.forEach((page: any) => {
    if (!page.properties) return;

    const prop = page.properties[NOTION_SYNC_PROPS.GOOGLE_EVENT_ID];
    if (prop && prop.rich_text && Array.isArray(prop.rich_text) && prop.rich_text.length > 0) {
      const gId = prop.rich_text[0].plain_text;
      if (gId) {
        notionPageMap.set(gId, page);
      }
    }
  });

  const processedGoogleEventIds = new Set<string>();
  allGoogleEvents.forEach(({ event }) => processedGoogleEventIds.add(event.id));

  const googleFetchFailed = allGoogleEvents.length === 0 && result.calendarErrors.length > 0;
  
  if (googleFetchFailed) {
    console.warn('Google Calendar fetch completely failed - skipping all sync operations to prevent data loss');
    return result;
  }

  const limit = pLimit(5);
  
  const syncTasks = allGoogleEvents.map(({ event, calendarName }) =>
    limit(async () => {
      try {
        if (notionPageMap.has(event.id)) {
          const page = notionPageMap.get(event.id);
          if (!hasEventChanged(page, event, calendarName)) {
            return { type: 'skipped' as const, eventId: event.id };
          }
          await notion.updatePage(page.id, event, calendarName);
          return { type: 'updated' as const, eventId: event.id };
        } else {
          const existingPage = await notion.findPageByGoogleEventId(NOTION_DATABASE_ID, event.id);
          if (existingPage) {
            await notion.updatePage(existingPage.id, event, calendarName);
            return { type: 'updated' as const, eventId: event.id };
          }
          await notion.createPage(NOTION_DATABASE_ID, event, calendarName);
          return { type: 'added' as const, eventId: event.id };
        }
      } catch (error) {
        return { type: 'error' as const, eventId: event.id, error: (error as Error).message };
      }
    })
  );

  const syncResults = await Promise.all(syncTasks);
  for (const r of syncResults) {
    if (r.type === 'updated') result.updated++;
    else if (r.type === 'added') result.added++;
    else if (r.type === 'skipped') result.skipped++;
    else if (r.type === 'error') result.errors.push({ eventId: r.eventId, error: r.error });
  }

  const pagesToDelete = Array.from(notionPageMap.entries()).filter(([gId, page]) => {
    if (processedGoogleEventIds.has(gId)) return false;
    const dateProp = page.properties['데드라인'];
    if (!dateProp?.date?.start) return false;
    const pageDate = new Date(dateProp.date.start);
    return pageDate >= timeMin && pageDate <= timeMax;
  });

  const deleteTasks = pagesToDelete.map(([gId, page]) =>
    limit(async () => {
      try {
        await notion.deletePage(page.id);
        return { type: 'deleted' as const, eventId: gId };
      } catch (error) {
        return { type: 'error' as const, eventId: gId, error: `Delete failed: ${(error as Error).message}` };
      }
    })
  );

  const deleteResults = await Promise.all(deleteTasks);
  for (const r of deleteResults) {
    if (r.type === 'deleted') result.deleted++;
    else if (r.type === 'error') result.errors.push({ eventId: r.eventId, error: r.error });
  }

  return result;
}
