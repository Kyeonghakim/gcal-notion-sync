import { google, calendar_v3 } from 'googleapis';
import { CalendarListEntry, CalendarEvent } from '@/types/calendar';

const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];

function getAuth() {
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY environment variable is not set');
  }

  try {
    const credentials = JSON.parse(serviceAccountKey);
    return new google.auth.JWT(
      credentials.client_email,
      undefined,
      credentials.private_key,
      SCOPES
    );
  } catch (error) {
    throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY: ' + (error as Error).message);
  }
}

export async function listCalendars(): Promise<CalendarListEntry[]> {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.calendarList.list();
  const items = response.data.items || [];

  return items.map((item) => ({
    id: item.id || '',
    summary: item.summary || '',
    description: item.description || undefined,
    primary: item.primary || false,
  }));
}

export async function getCalendarEvents(
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> {
  const auth = getAuth();
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.list({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const items = response.data.items || [];

  return items.map((item) => {
    const isAllDay = !!item.start?.date;
    return {
      id: item.id || '',
      summary: item.summary || '(No Title)',
      description: item.description || undefined,
      location: item.location || undefined,
      start: {
        dateTime: item.start?.dateTime || undefined,
        date: item.start?.date || undefined,
        timeZone: item.start?.timeZone || undefined,
      },
      end: {
        dateTime: item.end?.dateTime || undefined,
        date: item.end?.date || undefined,
        timeZone: item.end?.timeZone || undefined,
      },
      status: item.status || 'confirmed',
      htmlLink: item.htmlLink || undefined,
      isAllDay,
    };
  });
}
