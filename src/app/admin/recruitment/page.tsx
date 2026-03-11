import { requireAdmin } from '@/lib/auth';
import { getRecruitmentInfos } from '@/server/queries/recruitment';
import { RecruitmentManager } from './RecruitmentManager';

export default async function RecruitmentPage() {
  await requireAdmin();

  const items = await getRecruitmentInfos();

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Recruitment Info</h1>
      <RecruitmentManager items={JSON.parse(JSON.stringify(items))} />
    </div>
  );
}
