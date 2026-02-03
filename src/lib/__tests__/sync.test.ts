import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncCalendarEvents } from '../sync';
import { listCalendars, getCalendarEvents } from '../google-calendar';
import { NotionClient } from '../notion';
import { NOTION_SYNC_PROPS } from '../../types/notion';

vi.mock('../google-calendar', () => ({
  listCalendars: vi.fn(),
  getCalendarEvents: vi.fn(),
}));

vi.mock('../notion', () => {
  return {
    NotionClient: vi.fn(),
  };
});

describe('syncCalendarEvents', () => {
  const mockNotionKey = 'test-notion-key';
  const mockDatabaseId = 'test-database-id';

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTION_KEY = mockNotionKey;
    process.env.NOTION_DATABASE_ID = mockDatabaseId;
  });

  it('should throw error if NOTION_KEY or NOTION_DATABASE_ID is missing', async () => {
    delete process.env.NOTION_KEY;
    await expect(syncCalendarEvents()).rejects.toThrow('Missing NOTION_KEY or NOTION_DATABASE_ID');
  });

  it('should sync events correctly (added, updated, deleted)', async () => {
    const mockCalendars = [{ id: 'cal1', summary: 'Calendar 1' }];
    (listCalendars as any).mockResolvedValue(mockCalendars);

    const now = new Date();
    const event1 = { 
      id: 'g1', 
      summary: 'Event 1', 
      status: 'confirmed', 
      start: { dateTime: now.toISOString() }, 
      end: { dateTime: now.toISOString() },
      isAllDay: false 
    };
    const event2 = { 
      id: 'g2', 
      summary: 'Event 2', 
      status: 'confirmed', 
      start: { dateTime: now.toISOString() }, 
      end: { dateTime: now.toISOString() },
      isAllDay: false 
    };
    (getCalendarEvents as any).mockResolvedValue([event1, event2]);

    const mockNotionClientInstance = {
      ensureSyncProperties: vi.fn().mockResolvedValue(undefined),
      getSyncedPages: vi.fn(),
      createPage: vi.fn().mockResolvedValue({}),
      updatePage: vi.fn().mockResolvedValue({}),
      deletePage: vi.fn().mockResolvedValue({}),
    };
    (NotionClient as any).mockImplementation(function() {
      return mockNotionClientInstance;
    });

    const existingPages = [
      {
        id: 'p1',
        properties: {
          [NOTION_SYNC_PROPS.GOOGLE_EVENT_ID]: { rich_text: [{ plain_text: 'g1' }] },
          'Event Date': { date: { start: now.toISOString() } }
        }
      },
      {
        id: 'p3',
        properties: {
          [NOTION_SYNC_PROPS.GOOGLE_EVENT_ID]: { rich_text: [{ plain_text: 'g3' }] },
          'Event Date': { date: { start: now.toISOString() } }
        }
      }
    ];
    mockNotionClientInstance.getSyncedPages.mockResolvedValue(existingPages);

    const result = await syncCalendarEvents();

    expect(result.added).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.deleted).toBe(1);
    expect(result.errors).toHaveLength(0);

    expect(mockNotionClientInstance.createPage).toHaveBeenCalledWith(mockDatabaseId, event2, 'Calendar 1');
    expect(mockNotionClientInstance.updatePage).toHaveBeenCalledWith('p1', event1, 'Calendar 1');
    expect(mockNotionClientInstance.deletePage).toHaveBeenCalledWith('p3');
  });

  it('should not delete event if it is outside the sync window', async () => {
    const mockCalendars = [{ id: 'cal1', summary: 'Calendar 1' }];
    (listCalendars as any).mockResolvedValue(mockCalendars);
    (getCalendarEvents as any).mockResolvedValue([]);

    const mockNotionClientInstance = {
      ensureSyncProperties: vi.fn().mockResolvedValue(undefined),
      getSyncedPages: vi.fn(),
      createPage: vi.fn(),
      updatePage: vi.fn(),
      deletePage: vi.fn(),
    };
    (NotionClient as any).mockImplementation(function() {
      return mockNotionClientInstance;
    });

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40);

    const existingPages = [
      {
        id: 'p_old',
        properties: {
          [NOTION_SYNC_PROPS.GOOGLE_EVENT_ID]: { rich_text: [{ plain_text: 'g_old' }] },
          'Event Date': { date: { start: oldDate.toISOString() } }
        }
      }
    ];
    mockNotionClientInstance.getSyncedPages.mockResolvedValue(existingPages);

    const result = await syncCalendarEvents();

    expect(result.deleted).toBe(0);
    expect(mockNotionClientInstance.deletePage).not.toHaveBeenCalled();
  });

  it('should handle errors during sync and continue', async () => {
    const mockCalendars = [{ id: 'cal1', summary: 'Calendar 1' }];
    (listCalendars as any).mockResolvedValue(mockCalendars);

    const event1 = { id: 'g1', summary: 'Event 1', status: 'confirmed', start: { dateTime: new Date().toISOString() }, end: { dateTime: new Date().toISOString() } };
    (getCalendarEvents as any).mockResolvedValue([event1]);

    const mockNotionClientInstance = {
      ensureSyncProperties: vi.fn().mockResolvedValue(undefined),
      getSyncedPages: vi.fn().mockResolvedValue([]),
      createPage: vi.fn().mockRejectedValue(new Error('Notion API Error')),
      updatePage: vi.fn(),
      deletePage: vi.fn(),
    };
    (NotionClient as any).mockImplementation(function() {
      return mockNotionClientInstance;
    });

    const result = await syncCalendarEvents();

    expect(result.added).toBe(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toEqual({ eventId: 'g1', error: 'Notion API Error' });
  });
});
