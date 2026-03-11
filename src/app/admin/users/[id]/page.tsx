import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getUserDetail } from '@/server/queries/admin';
import { getSnapshotScores } from '@/server/scoring';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RoleToggle } from './RoleToggle';
import { StudentIdButton } from './StudentIdButton';
import { CognitiveRadarChart } from '@/components/CognitiveRadarChart';
import { getTranslations, getLocale } from 'next-intl/server';

type Props = {
  params: Promise<{ id: string }>;
};

export default async function UserDetailPage({ params }: Props) {
  await requireAdmin();
  const [{ id }, t, locale] = await Promise.all([
    params,
    getTranslations('admin.users'),
    getLocale(),
  ]);

  const user = await getUserDetail(id);
  if (!user) notFound();

  // Fetch scores if user has completed questionnaire
  const scores = user.latestSnapshotId
    ? await getSnapshotScores(user.latestSnapshotId)
    : null;

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const fields = [
    { label: t('username'), value: user.username },
    { label: t('fieldName'), value: user.name || '—' },
    { label: t('fieldSchool'), value: user.school || '—' },
    { label: t('fieldMajor'), value: user.major || '—' },
    { label: t('fieldGrade'), value: user.grade || '—' },
    { label: t('fieldRegistered'), value: formatDate(user.createdAt) },
    { label: t('fieldQuestionnaire'), value: user.snapshotCount > 0
      ? t('completedCount', { count: user.snapshotCount })
      : t('notCompleted') },
    { label: t('activitiesJoined'), value: String(user.activityCount) },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t('userDetail')}</h1>
        <Link
          href="/admin/users"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t('backToUsers')}
        </Link>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle>{user.name || user.username}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            {fields.map((field) => (
              <div key={field.label} className="flex items-center justify-between border-b pb-2 last:border-0">
                <dt className="text-sm text-muted-foreground">{field.label}</dt>
                <dd className="text-sm font-medium">{field.value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Cognitive Profile Radar Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t('cognitiveProfile')}</CardTitle>
          {user.latestSnapshotDate && (
            <p className="text-sm text-muted-foreground">
              {t('lastCompleted', { date: formatDate(user.latestSnapshotDate) })}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {scores ? (
            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                {t('overallScore')}: <span className="font-medium text-foreground">{scores.overallScore}</span>
              </p>
              <CognitiveRadarChart
                initialScores={scores}
                currentScores={null}
                labelA={t('cognitiveScores')}
              />
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t('noQuestionnaireData')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Role Management */}
      <Card>
        <CardHeader>
          <CardTitle>{t('roleManagement')}</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleToggle userId={user.id} currentRole={user.role} username={user.username} />
        </CardContent>
      </Card>

      {/* Student ID */}
      {user.hasStudentId && (
        <Card>
          <CardHeader>
            <CardTitle>{t('studentIdTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <StudentIdButton userId={user.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
