import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { locales, defaultLocale, type Locale } from '@/i18n/config';

const COOKIE_NAME = 'NEXT_LOCALE';

function detectLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return defaultLocale;
  for (const part of acceptLanguage.split(',')) {
    const lang = part.split(';')[0].trim().split('-')[0].toLowerCase();
    if (locales.includes(lang as Locale)) {
      return lang as Locale;
    }
  }
  return defaultLocale;
}

export default auth((req) => {
  const response = (req as unknown as { auth: unknown }).auth
    ? NextResponse.next()
    : NextResponse.next();

  // Set locale cookie on first visit based on browser language
  if (!req.cookies.get(COOKIE_NAME)) {
    const detected = detectLocale(req.headers.get('accept-language'));
    response.cookies.set(COOKIE_NAME, detected, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  return response;
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - api/auth (Auth.js routes handled internally)
     * - api/health (public health-check endpoint)
     * - public assets (SVGs, images)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|api/auth|api/health|.*\\.svg$|.*\\.png$|.*\\.jpg$|.*\\.ico$).*)',
  ],
};
