'use server';

import { cookies } from 'next/headers';
import { defaultLocale, locales, type Locale } from './config';

const COOKIE_NAME = 'NEXT_LOCALE';

function isValidLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export async function getUserLocale(): Promise<Locale> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value && isValidLocale(value) ? value : defaultLocale;
}

export async function setUserLocale(locale: Locale) {
  if (!isValidLocale(locale)) return;
  (await cookies()).set(COOKIE_NAME, locale);
}
