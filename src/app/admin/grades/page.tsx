import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getAllGradeOptions } from '@/server/queries/admin';
import { GradeOptionsTable } from './GradeOptionsTable';
import { getTranslations } from 'next-intl/server';

export default async function AdminGradesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const [options, t] = await Promise.all([getAllGradeOptions(), getTranslations('admin.grades')]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>
      <GradeOptionsTable options={options} />
    </div>
  );
}
