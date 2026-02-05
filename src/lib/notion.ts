import { Client } from '@notionhq/client';
import pLimit from 'p-limit';
import { CalendarEvent } from '../types/calendar';
import { NOTION_SYNC_PROPS } from '../types/notion';

const limit = pLimit(3);

interface DatabaseWithProperties {
  properties: Record<string, unknown>;
}

export class NotionClient {
  private client: Client;

  constructor(token: string) {
    this.client = new Client({ auth: token });
  }

  async ensureSyncProperties(databaseId: string) {
    return limit(async () => {
      const database = await this.client.databases.retrieve({ database_id: databaseId }) as unknown as DatabaseWithProperties;
      const properties = database?.properties || {};

      const updates: Record<string, { rich_text: object } | { date: object }> = {};

      if (!properties[NOTION_SYNC_PROPS.GOOGLE_EVENT_ID]) {
        updates[NOTION_SYNC_PROPS.GOOGLE_EVENT_ID] = { rich_text: {} };
      }
      if (!properties[NOTION_SYNC_PROPS.CALENDAR_NAME]) {
        updates[NOTION_SYNC_PROPS.CALENDAR_NAME] = { rich_text: {} };
      }
      if (!properties[NOTION_SYNC_PROPS.LAST_SYNCED]) {
        updates[NOTION_SYNC_PROPS.LAST_SYNCED] = { date: {} };
      }

      if (Object.keys(updates).length > 0) {
        await this.client.databases.update({
          database_id: databaseId,
          properties: updates,
        } as Parameters<typeof this.client.databases.update>[0]);
      }
    });
  }

  async getSyncedPages(databaseId: string) {
    return limit(async () => {
      const pages: Array<Record<string, unknown>> = [];
      let cursor: string | undefined = undefined;

      try {
        do {
          const response = await this.client.databases.query({
            database_id: databaseId,
            start_cursor: cursor,
            filter: {
              property: NOTION_SYNC_PROPS.GOOGLE_EVENT_ID,
              rich_text: {
                is_not_empty: true,
              },
            },
          });

          pages.push(...response.results);
          cursor = response.next_cursor ?? undefined;
        } while (cursor);
      } catch (error) {
        const errorMessage = (error as Error).message || '';
        // Only return empty array if the property doesn't exist yet
        // This happens on first sync before ensureSyncProperties creates the property
        const isPropertyNotFoundError = 
          errorMessage.includes('property does not exist') ||
          errorMessage.includes('Could not find property') ||
          errorMessage.includes('is not a property that exists');
        
        if (isPropertyNotFoundError) {
          console.warn('getSyncedPages: Property not found (first sync), returning empty array');
          return [];
        }
        
        // For all other errors (network, rate limit, etc.), re-throw
        // This prevents silent failures that could cause duplicate entries
        console.error('getSyncedPages failed with critical error:', errorMessage);
        throw error;
      }

      return pages;
    });
  }

  async findPageByGoogleEventId(databaseId: string, googleEventId: string) {
    return limit(async () => {
      const response = await this.client.databases.query({
        database_id: databaseId,
        filter: {
          property: NOTION_SYNC_PROPS.GOOGLE_EVENT_ID,
          rich_text: {
            equals: googleEventId,
          },
        },
      });

      return response.results[0] || null;
    });
  }

  async createPage(databaseId: string, event: CalendarEvent, calendarName: string) {
    return limit(async () => {
      const properties = this.mapEventToProperties(event, calendarName);
      
      return await this.client.pages.create({
        parent: { database_id: databaseId },
        properties: properties as Parameters<typeof this.client.pages.create>[0]['properties'],
      });
    });
  }

  async updatePage(pageId: string, event: CalendarEvent, calendarName: string) {
    return limit(async () => {
      const properties = this.mapEventToProperties(event, calendarName);
      
      return await this.client.pages.update({
        page_id: pageId,
        properties: properties as Parameters<typeof this.client.pages.update>[0]['properties'],
      });
    });
  }

  async deletePage(pageId: string) {
    return limit(async () => {
      return await this.client.pages.update({
        page_id: pageId,
        archived: true,
      });
    });
  }

  private mapEventToProperties(event: CalendarEvent, calendarName: string): Record<string, unknown> {
    const startTime = event.start.dateTime || event.start.date;
    const endTime = event.end.dateTime || event.end.date;

    const properties: Record<string, unknown> = {
      title: {
        title: [
          {
            text: {
              content: event.summary || '(No Title)',
            },
          },
        ],
      },
      [NOTION_SYNC_PROPS.GOOGLE_EVENT_ID]: {
        rich_text: [
          {
            text: {
              content: event.id,
            },
          },
        ],
      },
      [NOTION_SYNC_PROPS.CALENDAR_NAME]: {
        rich_text: [
          {
            text: {
              content: calendarName,
            },
          },
        ],
      },
      [NOTION_SYNC_PROPS.LAST_SYNCED]: {
        date: {
          start: new Date().toISOString(),
        },
      },
    };

    if (startTime && endTime) {
      properties['데드라인'] = {
        date: {
          start: startTime,
          end: startTime === endTime ? null : endTime,
        },
      };
    }

    if (event.location) {
      properties['Location'] = {
        rich_text: [
          {
            text: {
              content: event.location,
            },
          },
        ],
      };
    }

    if (event.description) {
      properties['Description'] = {
        rich_text: [
          {
            text: {
              content: event.description.substring(0, 2000),
            },
          },
        ],
      }
    }

    return properties;
  }
}
