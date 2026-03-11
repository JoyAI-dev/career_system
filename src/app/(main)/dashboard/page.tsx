import { getTranslations } from 'next-intl/server';

export default async function DashboardPage() {
  const t = await getTranslations('dashboard');

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-muted-foreground">
        {t('welcome')}
      </p>
    </div>
  );
}
