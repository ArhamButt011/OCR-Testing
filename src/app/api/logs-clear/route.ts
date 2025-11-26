// src/app/api/logs-clear/route.ts
import { getLogCapture } from '@/lib/logCapture';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const logCapture = getLogCapture();
    logCapture.clearLogs();
    
    return NextResponse.json({ success: true, message: 'Logs cleared' });
  } catch (error) {
  console.error('Failed to clear logs:', error);
  return NextResponse.json({ success: false, error: 'Failed to clear logs' }, { status: 500 });
}
}