// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import '@/lib/autoLogging';
import { requestContext } from '@/lib/autoLogging';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Wrap API requests with context
  if (
    pathname.startsWith('/api/') &&
    pathname !== '/api/logs-stream' &&
    pathname !== '/api/logs-clear'
  ) {
    console.log('🎯 Setting context for:', pathname, request.method);
    return requestContext.run(
      {
        endpoint: pathname,
        method: request.method,
        startTime: Date.now(),
      },
      () => handleAuthAndProceed(request)
    );
  }

  return handleAuthAndProceed(request);
}

function handleAuthAndProceed(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('token')?.value;
  const role = request.cookies.get('role')?.value;

  // Root route
  if (pathname === '/') {
    if (token) {
      if (role === 'admin') return NextResponse.redirect(new URL('/jobs', request.url));
      return NextResponse.redirect(new URL('/extracted-data-monitoring', request.url));
    }
  }

  // Admin login or root
  if (pathname.startsWith('/admin-login') || pathname === '/') {
    if (token) {
      if (role === 'admin') return NextResponse.redirect(new URL('/jobs', request.url));
      return NextResponse.redirect(new URL('/extracted-data-monitoring', request.url));
    }
  }

  // Login route
  if (pathname === '/login') {
    if (token) {
      if (role === 'admin') return NextResponse.redirect(new URL('/jobs', request.url));
      return NextResponse.redirect(new URL('/extracted-data-monitoring', request.url));
    }
  }

  // Admin-only routes
  if (
    pathname.startsWith('/logs') ||
    pathname.startsWith('/roles-requests') ||
    pathname.startsWith('/pod-ocr')
  ) {
    if (!token || role !== 'admin') {
      return NextResponse.redirect(new URL('/admin-login', request.url));
    }
  }

  // Extracted data monitoring
  if (pathname === '/extracted-data-monitoring') {
    if (token && (role === 'reviewer' || role === 'standarduser')) {
      return NextResponse.next();
    } else if (token && role === 'admin') {
      return NextResponse.next();
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Admin login with existing token
  if (pathname === '/admin-login' && token && role === 'admin') {
    return NextResponse.redirect(new URL('/jobs', request.url));
  }

  // Non-admin users trying admin-only pages
  if (token && (role === 'reviewer' || role === 'standarduser')) {
    if (
      pathname.startsWith('/logs') ||
      pathname.startsWith('/roles-requests') ||
      pathname.startsWith('/pod-ocr')
    ) {
      return NextResponse.redirect(new URL('/extracted-data-monitoring', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/jobs',
    '/logs',
    '/pod-ocr',
    '/extracted-data-monitoring',
    '/admin-login',
    '/login',
    '/roles-requests',
    '/',
    '/api/:path*',
  ],
};

