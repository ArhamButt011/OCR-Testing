import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const Token = request.cookies.get('token')?.value;
  const Role = request.cookies.get('role')?.value;

  if (pathname === '/') {
    if (Token) {
      if (Role === 'admin') {
        return NextResponse.redirect(new URL('/jobs', request.url));
      }
      return NextResponse.redirect(new URL('/extracted-data-monitoring', request.url));
    }
  }

  if (pathname.startsWith('/admin-login') || pathname === '/') {
    if (Token) {
      if (Role === 'admin') {
        return NextResponse.redirect(new URL('/jobs', request.url)); 
      }
      return NextResponse.redirect(new URL('/extracted-data-monitoring', request.url)); 
    }
  }

  if (pathname === '/login') {
    if (Token) {
      if (Role === 'admin') {
        return NextResponse.redirect(new URL('/jobs', request.url)); 
      }
      return NextResponse.redirect(new URL('/extracted-data-monitoring', request.url));
    }
  }

  if (pathname.startsWith('/logs') || pathname.startsWith('/roles-requests') || pathname.startsWith('/pod-ocr')) {
    if (!Token || Role !== 'admin') {
      return NextResponse.redirect(new URL('/admin-login', request.url)); 
    }
  }

  if (pathname === '/extracted-data-monitoring') {
    if (Token && (Role === 'reviewer' || Role === 'standarduser')) {
      return NextResponse.next(); 
    } 
    else if (Token && Role === 'admin') {
      return NextResponse.next(); 
    } 
    else {
      return NextResponse.redirect(new URL('/login', request.url)); 
    }
  }

  if (pathname === '/admin-login' && Token && Role === 'admin') {
    return NextResponse.redirect(new URL('/jobs', request.url)); 
  }

  if (Token && (Role === 'reviewer' || Role === 'standarduser')) {
    if (pathname.startsWith('/logs') || pathname.startsWith('/roles-requests') || pathname.startsWith('/pod-ocr')) {
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
  ],
};
