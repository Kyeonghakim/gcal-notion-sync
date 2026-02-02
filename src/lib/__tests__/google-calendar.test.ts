import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listCalendars, getCalendarEvents } from '../google-calendar';
import { google } from 'googleapis';

vi.mock('googleapis', () => {
  return {
    google: {
      auth: {
        JWT: vi.fn().mockImplementation(function() {
          return {
            authorize: vi.fn(),
          };
        }),
      },
      calendar: vi.fn().mockReturnValue({
        calendarList: {
          list: vi.fn(),
        },
        events: {
          list: vi.fn(),
        },
      }),
    },
  };
});

describe('google-calendar', () => {
  const mockServiceAccountKey = JSON.stringify({
    client_email: 'test@example.com',
    private_key: 'test-private-key',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = mockServiceAccountKey;
  });

  describe('listCalendars', () => {
    it('should fetch calendar list and map them correctly', async () => {
      const mockItems = [
        { id: 'cal1', summary: 'Calendar 1', description: 'Desc 1', primary: true },
        { id: 'cal2', summary: 'Calendar 2' },
      ];

      const mockList = google.calendar({ version: 'v3' }).calendarList.list as any;
      mockList.mockResolvedValue({
        data: { items: mockItems },
      } as any);

      const calendars = await listCalendars();

      expect(calendars).toHaveLength(2);
      expect(calendars[0]).toEqual({
        id: 'cal1',
        summary: 'Calendar 1',
        description: 'Desc 1',
        primary: true,
      });
      expect(calendars[1]).toEqual({
        id: 'cal2',
        summary: 'Calendar 2',
        description: undefined,
        primary: false,
      });
    });

    it('should return empty array if no items', async () => {
      const mockList = google.calendar({ version: 'v3' }).calendarList.list as any;
      mockList.mockResolvedValue({
        data: {},
      } as any);

      const calendars = await listCalendars();
      expect(calendars).toEqual([]);
    });

    it('should throw error if env var is missing', async () => {
      delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
      await expect(listCalendars()).rejects.toThrow('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
    });
  });

  describe('getCalendarEvents', () => {
    it('should fetch events and distinguish all-day events', async () => {
      const mockItems = [
        {
          id: 'event1',
          summary: 'Timed Event',
          start: { dateTime: '2024-01-01T10:00:00Z' },
          end: { dateTime: '2024-01-01T11:00:00Z' },
          status: 'confirmed',
        },
        {
          id: 'event2',
          summary: 'All Day Event',
          start: { date: '2024-01-02' },
          end: { date: '2024-01-03' },
          status: 'confirmed',
        },
      ];

      const mockList = google.calendar({ version: 'v3' }).events.list as any;
      mockList.mockResolvedValue({
        data: { items: mockItems },
      } as any);

      const timeMin = new Date('2024-01-01T00:00:00Z');
      const timeMax = new Date('2024-01-31T23:59:59Z');

      const events = await getCalendarEvents('primary', timeMin, timeMax);

      expect(events).toHaveLength(2);
      expect(events[0].summary).toBe('Timed Event');
      expect(events[0].isAllDay).toBe(false);
      expect(events[0].start.dateTime).toBe('2024-01-01T10:00:00Z');

      expect(events[1].summary).toBe('All Day Event');
      expect(events[1].isAllDay).toBe(true);
      expect(events[1].start.date).toBe('2024-01-02');
    });

    it('should pass correct parameters to google api', async () => {
      const mockList = google.calendar({ version: 'v3' }).events.list as any;
      mockList.mockResolvedValue({ data: { items: [] } } as any);

      const timeMin = new Date('2024-01-01T00:00:00Z');
      const timeMax = new Date('2024-01-31T23:59:59Z');

      await getCalendarEvents('test-cal', timeMin, timeMax);

      expect(mockList).toHaveBeenCalledWith({
        calendarId: 'test-cal',
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });
    });
  });
});
