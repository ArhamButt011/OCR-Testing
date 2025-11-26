// src/app/api/cv-logs/route.ts
import { NextResponse } from 'next/server';
import { getCVLogWatcher } from '@/lib/cvLogWatcher';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const basePath = searchParams.get('basePath');
  const sourcesParam = searchParams.get('sources') || 'all';
  const lines = Math.min(parseInt(searchParams.get('lines') || '100'), 500);

  if (!basePath) {
    return NextResponse.json(
      { error: 'Missing basePath parameter' },
      { status: 400 }
    );
  }

  try {
    const watcher = getCVLogWatcher();
    const sources = sourcesParam === 'all'
      ? watcher.getAvailableSources()
      : sourcesParam.split(',');

    const logs = await watcher.getHistoricalLogs(basePath, sources, lines);

    return NextResponse.json({ 
      logs,
      total: logs.length,
      sources,
      basePath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching CV logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs', details: String(error) },
      { status: 500 }
    );
  }
}