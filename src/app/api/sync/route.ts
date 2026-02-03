import { NextResponse } from 'next/server';
import { syncCalendarEvents } from '@/lib/sync';

export async function POST() {
  try {
    const result = await syncCalendarEvents();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
