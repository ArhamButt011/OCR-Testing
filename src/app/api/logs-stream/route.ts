// src/app/api/logs-stream/route.ts
import { getLogCapture, LogEntry } from '@/lib/logCapture';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  console.log('📡 Logs stream connected');
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      const logCapture = getLogCapture();
      
      // Send existing logs
      const existingLogs = logCapture.getLogs();
      console.log('📤 Sending existing logs:', existingLogs.length);
      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: 'history', logs: existingLogs })}\n\n`)
      );

      // Listen for new logs
      const logHandler = (log: LogEntry) => {
        console.log('Broadcasting new log:', log.endpoint);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'log', log })}\n\n`)
        );
      };

      logCapture.on('log', logHandler);

      // Handle client disconnect
      request.signal.addEventListener('abort', () => {
        console.log('📡 Client disconnected from logs stream');
        logCapture.off('log', logHandler);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}