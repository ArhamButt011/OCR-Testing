// src/lib/autoLogging.ts
import { NextResponse } from 'next/server';
import { getLogCapture } from './logCapture';

export interface RequestContext {
  endpoint: string;
  method: string;
  startTime: number;
}

export interface ApiResponseBody {
  message?: string;
  error?: string;
  jobs?: unknown[];
  data?: unknown[];
  [key: string]: unknown; 
}

const isServer = typeof window === 'undefined';
class TypedAsyncLocalStorage<T> {
  private store: T | undefined = undefined;
  
  getStore(): T | undefined { 
    return this.store; 
  }
  
  run<R>(store: T, callback: () => R): R {
    const previousStore = this.store;
    this.store = store;
    try {
      return callback();
    } finally {
      this.store = previousStore;
    }
  }
  
  enterWith(store: T): void {
    this.store = store;
  }
  
  exit<R>(callback: () => R): R {
    const previousStore = this.store;
    this.store = undefined;
    try {
      return callback();
    } finally {
      this.store = previousStore;
    }
  }
}

let AsyncLocalStorageClass: typeof TypedAsyncLocalStorage;

if (isServer) {
  try {
    const asyncHooks = require('async_hooks');
    AsyncLocalStorageClass = asyncHooks.AsyncLocalStorage;
  } catch (error) {
    console.warn('async_hooks not available, using fallback');
    AsyncLocalStorageClass = TypedAsyncLocalStorage;
  }
} else {
  AsyncLocalStorageClass = TypedAsyncLocalStorage;
}

export const requestContext = isServer 
  ? new AsyncLocalStorageClass<RequestContext>()
  : null;

if (isServer) {
  console.log('Initializing auto-logging system...');
  
  try {
    getLogCapture();
  } catch (error) {
    console.error('Failed to initialize log capture:', error);
  }
}

const originalJson = NextResponse.json.bind(NextResponse);

(NextResponse as unknown as { json: (body: ApiResponseBody, init?: ResponseInit) => Response }).json = function (
  body: ApiResponseBody,
  init?: ResponseInit
) {
  const statusCode = init?.status || 200;
  
  const context = isServer && requestContext ? requestContext.getStore() : null;

  if (isServer) {
    console.log('NextResponse.json called:', {
      statusCode,
      hasContext: !!context,
      endpoint: context?.endpoint,
    });
  }

  if (context && isServer) {
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
    } else {
      message = body?.message || body?.error || 'Request completed';
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

      console.log('Auto-logged:', {
        endpoint: context.endpoint,
        method: context.method,
        statusCode,
        type,
        duration: `${duration}ms`,
      });
    } catch (error) {
      console.error('Failed to auto-log:', error);
    }
  } else if (isServer && !context) {
    console.warn('No context available for:', { statusCode });
  }

  return originalJson(body, init);
};

if (isServer) {
  console.log('Auto-logging system initialized');
}

export function withRequestContext<T extends (...args: any[]) => Promise<Response>>(
  handler: T,
  endpoint: string
): T {
  return (async (...args: any[]) => {
    if (!isServer || !requestContext) {
      return handler(...args);
    }

    const request = args[0] as Request;
    const method = request.method;
    const startTime = Date.now();

    const context: RequestContext = {
      endpoint,
      method,
      startTime,
    };

    return requestContext.run(context, () => handler(...args));
  }) as T;
}