import { getRequestConfig } from 'next-intl/server';
import { getUserLocale } from './locale';
import { defaultLocale } from './config';

export default getRequestConfig(async () => {
  const locale = await getUserLocale();
  try {
    return {
      locale,
      messages: (await import(`../messages/${locale}.json`)).default,
    };
  } catch {
    return {
      locale: defaultLocale,
      messages: (await import(`../messages/${defaultLocale}.json`)).default,
    };
  }
});
