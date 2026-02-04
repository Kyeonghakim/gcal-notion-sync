import { listCalendars, getCalendarEvents } from './google-calendar';
import { NotionClient } from './notion';
import { NOTION_SYNC_PROPS } from '../types/notion';
import { CalendarEvent } from '../types/calendar';

export interface SyncResult {
  added: number;
  updated: number;
  deleted: number;
  errors: Array<{ eventId: string; error: string }>;
}

export async function syncCalendarEvents(): Promise<SyncResult> {
  const NOTION_KEY = process.env.NOTION_KEY;
  const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;
  const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

  if (!NOTION_KEY || !NOTION_DATABASE_ID) {
    throw new Error('Missing NOTION_KEY or NOTION_DATABASE_ID');
  }

  const notion = new NotionClient(NOTION_KEY);
  await notion.ensureSyncProperties(NOTION_DATABASE_ID);

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
      console.error(`Failed to fetch events for calendar ${GOOGLE_CALENDAR_ID}`, e);
    }
  }

  const calendars = await listCalendars();
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

  const result: SyncResult = { added: 0, updated: 0, deleted: 0, errors: [] };
  const processedGoogleEventIds = new Set<string>();

  for (const { event, calendarName } of allGoogleEvents) {
    processedGoogleEventIds.add(event.id);
    try {
      if (notionPageMap.has(event.id)) {
        const page = notionPageMap.get(event.id);
        await notion.updatePage(page.id, event, calendarName);
        result.updated++;
      } else {
        await notion.createPage(NOTION_DATABASE_ID, event, calendarName);
        result.added++;
      }
    } catch (error) {
      result.errors.push({ eventId: event.id, error: (error as Error).message });
    }
  }

  for (const [gId, page] of notionPageMap.entries()) {
    if (!processedGoogleEventIds.has(gId)) {
      // Logic: If page date is within [timeMin, timeMax] and NOT in GCal, then it was deleted in GCal.
      const dateProp = page.properties['데드라인'];
      let pageDate: Date | null = null;

      if (dateProp && dateProp.date && dateProp.date.start) {
        pageDate = new Date(dateProp.date.start);
      }

      if (pageDate && pageDate >= timeMin && pageDate <= timeMax) {
        try {
          await notion.deletePage(page.id);
          result.deleted++;
        } catch (error) {
          result.errors.push({ eventId: gId, error: `Delete failed: ${(error as Error).message}` });
        }
      }
    }
  }

  return result;
}
