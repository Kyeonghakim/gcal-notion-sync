import { NextResponse } from 'next/server';
import { syncCalendarEvents } from '@/lib/sync';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await syncCalendarEvents();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Cron sync failed:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
