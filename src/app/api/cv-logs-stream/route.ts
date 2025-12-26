// src/app/api/cv-logs-stream/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { getCVLogWatcher } from '@/lib/cvLogWatcher';
import fs from 'fs';
import path from 'path';


export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const basePath = searchParams.get('basePath');
  const sourcesParam = searchParams.get('sources') || 'all';

  console.log('🔍 CV Logs Request:', { basePath, sourcesParam });

  if (!basePath) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const errorData = JSON.stringify({ 
          error: 'Base path is required',
          type: 'error'
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  }

  try {
    if (!fs.existsSync(basePath)) {
      console.error('Directory does not exist:', basePath);
      
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const errorData = JSON.stringify({ 
            error: `Directory does not exist: ${basePath}`,
            type: 'error',
            errorType: 'directory_not_found'
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      });
    }

    const stats = fs.statSync(basePath);
    if (!stats.isDirectory()) {
      console.error('Path is not a directory:', basePath);
      
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          const errorData = JSON.stringify({ 
            error: `Path is not a directory: ${basePath}`,
            type: 'error',
            errorType: 'not_a_directory'
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        },
      });
    }
  } catch (error: any) {
    console.error('Error checking path:', error);
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        let errorMessage = `Cannot access path: ${basePath}`;
        let errorType = 'access_error';
        
        if (error.code === 'ENOENT') {
          errorMessage = `Directory does not exist: ${basePath}`;
          errorType = 'directory_not_found';
        } else if (error.code === 'EACCES') {
          errorMessage = `Permission denied: ${basePath}`;
          errorType = 'permission_denied';
        }
        
        const errorData = JSON.stringify({ 
          error: errorMessage,
          type: 'error',
          errorType,
          errorCode: error.code
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  }

  const sources = sourcesParam === 'all' 
    ? ['app', 'pixtral', 'lmdeploy_exec', 'lmdeploy_serve']
    : sourcesParam.split(',').filter(Boolean);

  console.log(`CV Logs SSE: basePath=${basePath}, sources=${sources.join(',')}`);

  // Check which files exist
  const missingFiles: string[] = [];
  const availableSources: string[] = [];

  sources.forEach(source => {
    const filePath = path.join(basePath, `${source}.log`);
    if (fs.existsSync(filePath)) {
      availableSources.push(source);
      console.log(`Found: ${source}.log`);
    } else {
      missingFiles.push(`${source}.log`);
      console.log(`Missing: ${source}.log`);
    }
  });

  if (availableSources.length === 0) {
    console.error('No log files found');
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const errorData = JSON.stringify({ 
          error: `No log files found in ${basePath}. Expected files: ${sources.map(s => `${s}.log`).join(', ')}`,
          type: 'error',
          errorType: 'no_files_found',
          missingFiles
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      console.log('CV logs SSE connection established');

      const watcher = getCVLogWatcher();

      // Send missing files warning if any
      if (missingFiles.length > 0) {
        console.log('Missing files:', missingFiles);
        const warningData = JSON.stringify({ 
          type: 'warning',
          missingFiles 
        });
        controller.enqueue(encoder.encode(`data: ${warningData}\n\n`));
      }

      // Start watching available files only
      try {
        await watcher.startWatching(basePath, availableSources);
      } catch (error: any) {
        console.error('Error starting watcher:', error);
        const errorData = JSON.stringify({ 
          error: error.message || 'Failed to start watching log files',
          type: 'error',
          errorType: 'watcher_error'
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
        return;
      }

      // Send historical logs
      try {
        const historicalLogs = await watcher.getHistoricalLogs(basePath, availableSources, 100);
        const historyData = JSON.stringify({ type: 'history', logs: historicalLogs });
        controller.enqueue(encoder.encode(`data: ${historyData}\n\n`));
      } catch (error) {
        console.error('Error reading historical logs:', error);
      }

      // Listen for new logs
      const logHandler = (log: any) => {
        if (availableSources.includes(log.source)) {
          const data = JSON.stringify({ type: 'log', log });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
      };

      watcher.on('log', logHandler);

      // Heartbeat
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'));
      }, 30000);

      // Cleanup on close
      const closeHandler = () => {
        console.log('CV logs SSE connection closed');
        clearInterval(heartbeat);
        watcher.off('log', logHandler);
      };

      request.signal.addEventListener('abort', closeHandler);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}