import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSystemSetting } from '@/server/queries/admin';
import { StudentIdToggle } from './StudentIdToggle';
import { getTranslations } from 'next-intl/server';

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const [requireStudentId, t] = await Promise.all([
    getSystemSetting('require_student_id'),
    getTranslations('admin.settings'),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <div className="max-w-2xl space-y-4">
        <StudentIdToggle initialValue={requireStudentId === 'true'} />
      </div>
    </div>
  );
}
