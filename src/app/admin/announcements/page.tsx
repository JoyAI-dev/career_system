import { requireAdminPage } from '@/lib/auth';
import { getAllAnnouncements } from '@/server/queries/announcement';
import { AnnouncementManager } from './AnnouncementManager';
import { getTranslations } from 'next-intl/server';

export default async function AnnouncementsPage() {
  await requireAdminPage();

  const [items, t] = await Promise.all([getAllAnnouncements(), getTranslations('admin.announcements')]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <AnnouncementManager items={JSON.parse(JSON.stringify(items))} />
    </div>
  );
}
