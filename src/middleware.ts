import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { locales, defaultLocale, type Locale } from '@/i18n/config';

export const runtime = 'nodejs';

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
     * Match only page routes. Exclude:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - api/* (all API routes handle their own auth; no locale detection needed)
     * - Static assets by extension (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico, .css, .js, .woff, .woff2)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|sitemap\\.xml|robots\\.txt|api/|.*\\.(?:svg|png|jpe?g|gif|webp|ico|css|js|woff2?)$).*)',
  ],
};
