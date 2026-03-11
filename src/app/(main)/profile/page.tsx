import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { getUserProfile, getActiveGradeOptions } from '@/server/queries/user';
import { hasCompletedQuestionnaire } from '@/server/queries/questionnaire';
import { ProfileForm } from './ProfileForm';
import { StudentIdUpload } from './StudentIdUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getTranslations } from 'next-intl/server';

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const [user, gradeOptions, hasCompleted, t] = await Promise.all([
    getUserProfile(session.user.id),
    getActiveGradeOptions(),
    hasCompletedQuestionnaire(session.user.id),
    getTranslations('profile'),
  ]);

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{t('title')}</h1>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('accountInfo')}</CardTitle>
            <CardDescription>Username: {user.username}</CardDescription>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('personalInfo')}</CardTitle>
            <CardDescription>{t('updateDetails')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileForm user={user} gradeOptions={gradeOptions} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('studentId')}</CardTitle>
            <CardDescription>{t('uploadStudentId')}</CardDescription>
          </CardHeader>
          <CardContent>
            <StudentIdUpload hasUpload={!!user.studentIdUrl} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('cognitiveReport')}</CardTitle>
            <CardDescription>
              {t('cognitiveReportDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasCompleted ? (
              <Button render={<Link href="/cognitive-report" />}>
                {t('viewReport')}
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('completeQuestionnaire')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
