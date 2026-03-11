import { requireAdmin } from '@/lib/auth';
import { getTags } from '@/server/queries/tag';
import { TagManager } from './TagManager';
import { getTranslations } from 'next-intl/server';

export default async function TagsPage() {
  await requireAdmin();

  const [tags, t] = await Promise.all([getTags(), getTranslations('admin.tags')]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <TagManager tags={tags} />
    </div>
  );
}
