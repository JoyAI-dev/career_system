import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }

  const t = await getTranslations('landing');
  const tc = await getTranslations('common');

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher />
      </div>
      <main className="flex flex-col items-center gap-6 p-8">
        <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">
          {t('description')}
        </p>
        <div className="flex gap-3">
          <Link href="/login">
            <Button size="lg">{tc('signIn')}</Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline">{tc('register')}</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
