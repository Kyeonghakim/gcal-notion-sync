import { config } from 'dotenv';
import { Client } from '@notionhq/client';
import { google } from 'googleapis';

config();

async function testNotion() {
    console.log('Testing Notion Connection...');
    const notion = new Client({ auth: process.env.NOTION_TOKEN });
    try {
        const response = await notion.databases.retrieve({ database_id: process.env.NOTION_DATABASE_ID! });
        console.log(`✅ Notion Connected! Database Title: ${response.title[0]?.plain_text || 'Untitled'}`);
        return true;
    } catch (error: any) {
        console.error('❌ Notion Connection Failed:', error.message);
        return false;
    }
}

async function testGoogle() {
    console.log('Testing Google Calendar Connection...');
    try {
        const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
        });
        const calendar = google.calendar({ version: 'v3', auth });
        const response = await calendar.calendarList.get({ calendarId: process.env.GOOGLE_CALENDAR_ID! });
        console.log(`✅ Google Calendar Connected! Summary: ${response.data.summary}`);
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
