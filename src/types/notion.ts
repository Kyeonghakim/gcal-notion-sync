export interface NotionSyncProperties {
  googleEventId: string;
  calendarName: string;
  lastSynced: string;
}

export interface NotionPageMetadata {
  id: string;
  googleEventId: string;
}

export const NOTION_SYNC_PROPS = {
  GOOGLE_EVENT_ID: 'Google Event ID',
  CALENDAR_NAME: 'Calendar Name',
  LAST_SYNCED: 'Last Synced',
} as const;
