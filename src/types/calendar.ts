export interface CalendarListEntry {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status: string;
  htmlLink?: string;
  isAllDay: boolean;
}
