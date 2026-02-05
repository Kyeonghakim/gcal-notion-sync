import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotionClient } from '../notion';
import { NOTION_SYNC_PROPS } from '../../types/notion';

vi.mock('p-limit', () => ({
  default: () => (fn: any) => fn(),
}));

const mockDatabasesRetrieve = vi.fn();
const mockDatabasesUpdate = vi.fn();
const mockDataSourcesQuery = vi.fn();
const mockPagesCreate = vi.fn();
const mockPagesUpdate = vi.fn();

vi.mock('@notionhq/client', () => {
  return {
    Client: class {
      databases = {
        retrieve: mockDatabasesRetrieve,
        update: mockDatabasesUpdate,
      };
      dataSources = {
        query: mockDataSourcesQuery,
      };
      pages = {
        create: mockPagesCreate,
        update: mockPagesUpdate,
      };
    },
  };
});

describe('NotionClient', () => {
  let notionClient: NotionClient;
  const databaseId = 'test-database-id';

  beforeEach(() => {
    vi.clearAllMocks();
    notionClient = new NotionClient('test-token');
  });

  describe('ensureSyncProperties', () => {
    it('should add missing properties to the database', async () => {
      mockDatabasesRetrieve.mockResolvedValueOnce({
        properties: {
          'Name': { title: {} },
        },
      });

      await notionClient.ensureSyncProperties(databaseId);

      expect(mockDatabasesUpdate).toHaveBeenCalledWith({
        database_id: databaseId,
        properties: {
          [NOTION_SYNC_PROPS.GOOGLE_EVENT_ID]: { rich_text: {} },
          [NOTION_SYNC_PROPS.CALENDAR_NAME]: { rich_text: {} },
          [NOTION_SYNC_PROPS.LAST_SYNCED]: { date: {} },
        },
      });
    });

    it('should not update database if all properties exist', async () => {
      mockDatabasesRetrieve.mockResolvedValueOnce({
        properties: {
          [NOTION_SYNC_PROPS.GOOGLE_EVENT_ID]: { rich_text: {} },
          [NOTION_SYNC_PROPS.CALENDAR_NAME]: { rich_text: {} },
          [NOTION_SYNC_PROPS.LAST_SYNCED]: { date: {} },
        },
      });

      await notionClient.ensureSyncProperties(databaseId);

      expect(mockDatabasesUpdate).not.toHaveBeenCalled();
    });
  });

  describe('findPageByGoogleEventId', () => {
    it('should query the database with correct filter', async () => {
      const googleEventId = 'test-event-id';
      mockDataSourcesQuery.mockResolvedValueOnce({
        results: [{ id: 'page-id' }],
      });

      const result = await notionClient.findPageByGoogleEventId(databaseId, googleEventId);

      expect(mockDataSourcesQuery).toHaveBeenCalledWith({
        data_source_id: databaseId,
        filter: {
          property: NOTION_SYNC_PROPS.GOOGLE_EVENT_ID,
          rich_text: {
            equals: googleEventId,
          },
        },
      });
      expect(result).toEqual({ id: 'page-id' });
    });

    it('should return null if no page is found', async () => {
      mockDataSourcesQuery.mockResolvedValueOnce({ results: [] });

      const result = await notionClient.findPageByGoogleEventId(databaseId, 'missing-id');

      expect(result).toBeNull();
    });
  });

  describe('createPage', () => {
    it('should create a page with mapped properties', async () => {
      const event = {
        id: 'event-id',
        summary: 'Test Event',
        start: { dateTime: '2023-01-01T10:00:00Z' },
        end: { dateTime: '2023-01-01T11:00:00Z' },
        location: 'Test Location',
        description: 'Test Description',
        status: 'confirmed',
        isAllDay: false,
      };

      await notionClient.createPage(databaseId, event, 'Main Calendar');

      expect(mockPagesCreate).toHaveBeenCalledWith({
        parent: { database_id: databaseId },
        properties: expect.objectContaining({
          title: { title: [{ text: { content: 'Test Event' } }] },
          [NOTION_SYNC_PROPS.GOOGLE_EVENT_ID]: { rich_text: [{ text: { content: 'event-id' } }] },
          [NOTION_SYNC_PROPS.CALENDAR_NAME]: { rich_text: [{ text: { content: 'Main Calendar' } }] },
          '데드라인': { date: { start: '2023-01-01T10:00:00Z', end: '2023-01-01T11:00:00Z' } },
          'Location': { rich_text: [{ text: { content: 'Test Location' } }] },
          'Description': { rich_text: [{ text: { content: 'Test Description' } }] },
        }),
      });
    });
  });

  describe('updatePage', () => {
    it('should update a page with mapped properties', async () => {
      const pageId = 'page-id';
      const event = {
        id: 'event-id',
        summary: 'Updated Event',
        start: { dateTime: '2023-01-01T12:00:00Z' },
        end: { dateTime: '2023-01-01T13:00:00Z' },
        status: 'confirmed',
        isAllDay: false,
      };

      await notionClient.updatePage(pageId, event, 'Main Calendar');

      expect(mockPagesUpdate).toHaveBeenCalledWith({
        page_id: pageId,
        properties: expect.objectContaining({
          title: { title: [{ text: { content: 'Updated Event' } }] },
        }),
      });
    });
  });

  describe('deletePage', () => {
    it('should archive the page', async () => {
      const pageId = 'page-id';

      await notionClient.deletePage(pageId);

      expect(mockPagesUpdate).toHaveBeenCalledWith({
        page_id: pageId,
        archived: true,
      });
    });
  });
});
