import { AsyncLocalStorage } from 'async_hooks';
import { NextResponse } from 'next/server';
import { getLogCapture } from './logCapture';

export interface RequestContext {
  endpoint: string;
  method: string;
  startTime: number;
}

// Create async local storage
export const requestContext = new AsyncLocalStorage<RequestContext>();

console.log('🔧 Initializing auto-logging system...');

// Initialize log capture first
getLogCapture();

// Store original NextResponse.json
const originalJson = NextResponse.json.bind(NextResponse);

// Override NextResponse.json
(NextResponse as any).json = function (body: any, init?: ResponseInit) {
  const statusCode = init?.status || 200;
  const context = requestContext.getStore();

  console.log('🔍 NextResponse.json called:', {
    statusCode,
    hasContext: !!context,
    endpoint: context?.endpoint,
  });

  if (context) {
    const duration = Date.now() - context.startTime;

    let type: 'success' | 'error' | 'warning' | 'info' = 'info';
    let message = '';

    if (statusCode >= 200 && statusCode < 300) {
      type = 'success';
      message = body?.message || body?.error || 'Request successful';
    } else if (statusCode >= 400 && statusCode < 500) {
      type = 'warning';
      message = body?.error || body?.message || 'Client error';
    } else if (statusCode >= 500) {
      type = 'error';
      message = body?.error || body?.message || 'Server error';
    }

    try {
      const logCapture = getLogCapture();
      logCapture.addLog({
        type,
        message,
        endpoint: context.endpoint,
        method: context.method,
        statusCode,
        metadata: {
          duration: `${duration}ms`,
          dataKeys: body ? Object.keys(body) : [],
          recordCount: body?.jobs?.length || body?.data?.length || undefined,
        },
      });

      console.log('✅ Auto-logged:', {
        endpoint: context.endpoint,
        method: context.method,
        statusCode,
        type,
        duration: `${duration}ms`,
      });
    } catch (error) {
      console.error('❌ Failed to auto-log:', error);
    }
  } else {
    console.warn('⚠️ No context available for:', { statusCode });
  }

  return originalJson(body, init);
};

console.log('✅ Auto-logging system initialized');
