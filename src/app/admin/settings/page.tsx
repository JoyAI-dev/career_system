import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getSystemSetting } from '@/server/queries/admin';
import { StudentIdToggle } from './StudentIdToggle';

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const requireStudentId = (await getSystemSetting('require_student_id')) === 'true';

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">System Settings</h1>
      <div className="max-w-2xl space-y-4">
        <StudentIdToggle initialValue={requireStudentId} />
      </div>
    </div>
  );
}
