import { config } from 'dotenv';
import { Client } from '@notionhq/client';
import { google } from 'googleapis';

config();

async function testNotion() {
    console.log('Testing Notion Connection...');
    const notion = new Client({ auth: process.env.NOTION_KEY });
    try {
        const response = await notion.databases.retrieve({ database_id: process.env.NOTION_DATABASE_ID! }) as any;
        console.log(`✅ Notion Connected! Database Title: ${response.title?.[0]?.plain_text || 'Untitled'}`);
        return true;
    } catch (error: any) {
        console.error('❌ Notion Connection Failed:', error.message);
        return false;
    }
}

async function testGoogle() {
    console.log('Testing Google Calendar Connection...');
    try {
        let serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!;
        serviceAccountKey = serviceAccountKey.trim();
        if ((serviceAccountKey.startsWith("'") && serviceAccountKey.endsWith("'")) ||
            (serviceAccountKey.startsWith('"') && serviceAccountKey.endsWith('"'))) {
            serviceAccountKey = serviceAccountKey.slice(1, -1);
        }
        const credentials = JSON.parse(serviceAccountKey);
        const auth = new google.auth.JWT({
            email: credentials.client_email,
            key: credentials.private_key,
            scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        });
        const calendar = google.calendar({ version: 'v3', auth });
        const calendarId = process.env.GOOGLE_CALENDAR_ID!;
        const now = new Date();
        const response = await calendar.events.list({
            calendarId,
            timeMin: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            timeMax: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            singleEvents: true,
            maxResults: 5,
        });
        const count = response.data.items?.length ?? 0;
        console.log(`✅ Google Calendar Connected! Calendar: ${calendarId}, Events (±7 days): ${count}`);
        return true;
    } catch (error: any) {
        console.error('❌ Google Calendar Connection Failed:', error.message);
        return false;
    }
}

async function main() {
    const notionSuccess = await testNotion();
    const googleSuccess = await testGoogle();

    if (notionSuccess && googleSuccess) {
        console.log('\n🎉 All systems operational!');
        process.exit(0);
    } else {
        console.log('\n⚠️ Some checks failed.');
        process.exit(1);
    }
}

main();
