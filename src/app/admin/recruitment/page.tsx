import { requireAdminPage } from '@/lib/auth';
import { getRecruitmentInfos } from '@/server/queries/recruitment';
import { RecruitmentManager } from './RecruitmentManager';
import { getTranslations } from 'next-intl/server';

export default async function RecruitmentPage() {
  await requireAdminPage();

  const [items, t] = await Promise.all([getRecruitmentInfos(), getTranslations('admin.recruitment')]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <RecruitmentManager items={JSON.parse(JSON.stringify(items))} />
    </div>
  );
}
