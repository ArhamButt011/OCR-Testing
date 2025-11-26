// src/lib/apiWrapper.ts
import { NextRequest, NextResponse } from 'next/server';
import { getLogCapture } from './logCapture';

type RouteContext = { params: Record<string, string | string[]> };

type RouteHandler = (
  request: NextRequest | Request,
  context: RouteContext  // ✅ Remove the optional ?
) => Promise<Response | NextResponse>;

export function withLogging(handler: RouteHandler) {
  return async (request: NextRequest | Request, context: RouteContext) => {
    const startTime = Date.now();
    const url = new URL(request.url);
    const endpoint = url.pathname;
    const method = request.method;

    console.log('🎯 API Wrapper: Handling', method, endpoint);

    try {
      // Call the actual handler
      const response = await handler(request, context);
      
      // Clone to read without consuming
      const clonedResponse = response.clone();
      const duration = Date.now() - startTime;
      const statusCode = response.status;

      // Try to read body
      let body: any = null;
      try {
        const text = await clonedResponse.text();
        if (text) {
          body = JSON.parse(text);
        }
      } catch (e) {
        // Not JSON or empty body
      }

      // Determine log type
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

      // Log it
      const logCapture = getLogCapture();
      logCapture.addLog({
        type,
        message,
        endpoint,
        method,
        statusCode,
        metadata: {
          duration: `${duration}ms`,
          dataKeys: body ? Object.keys(body) : [],
          recordCount: body?.jobs?.length || body?.data?.length || undefined,
        },
      });

      console.log('✅ Logged:', { endpoint, method, statusCode, type, duration: `${duration}ms` });

      return response;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error('❌ API Error:', error);

      // Log the error
      const logCapture = getLogCapture();
      logCapture.addLog({
        type: 'error',
        message: error.message || 'Internal server error',
        endpoint,
        method,
        statusCode: 500,
        metadata: {
          duration: `${duration}ms`,
          error: error.stack,
        },
      });

      throw error;
    }
  };
}