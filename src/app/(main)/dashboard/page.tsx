import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getActivityProgress, getUserJoinedActivities } from '@/server/queries/activity';
import { hasCompletedQuestionnaire } from '@/server/queries/questionnaire';
import { ActivityStepper } from '@/components/ActivityStepper';
import { ActivityJourneyFlow } from '@/components/ActivityJourneyFlow';
import { LandingCalendar } from '@/components/LandingCalendar';
import { FloatingReportButton } from '@/components/FloatingReportButton';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const isAdmin = session.user.role === 'ADMIN';

  // Admin sees simple dashboard (their main hub is /admin)
  if (isAdmin) {
    const t = await getTranslations('dashboard');
    return (
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-muted-foreground">{t('welcome')}</p>
      </div>
    );
  }

  // Student landing page — fetch all data in parallel
  const [steps, joinedActivities, questionnaireCompleted, t] = await Promise.all([
    getActivityProgress(session.user.id),
    getUserJoinedActivities(session.user.id),
    hasCompletedQuestionnaire(session.user.id),
    getTranslations('dashboard'),
  ]);

  // Find current activity stage for the journey flow
  const currentStep = steps.find((s) => s.state === 'current');

  // Get activities that belong to the current step's type (or all non-completed if no current step)
  const currentActivities = currentStep
    ? joinedActivities
        .filter((a) => a.type.name === currentStep.typeName)
        .map((a) => ({
          id: a.id,
          title: a.title,
          status: a.status,
          typeName: a.type.name,
        }))
    : joinedActivities
        .filter((a) => a.status !== 'COMPLETED')
        .map((a) => ({
          id: a.id,
          title: a.title,
          status: a.status,
          typeName: a.type.name,
        }));

  return (
    <div className="space-y-8">
      {/* Floating cognitive report button */}
      <FloatingReportButton currentStage={currentStep?.typeName ?? null} />

      {/* Section: Progress Stepper */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">{t('journeyTitle')}</h2>
        <div className="rounded-xl bg-white p-4 shadow-sm md:p-6">
          <ActivityStepper steps={steps} />
        </div>
      </section>

      {/* Section: 3-Step Journey Flow */}
      <section>
        <ActivityJourneyFlow
          currentTypeName={currentStep?.typeName ?? null}
          currentActivities={currentActivities}
          currentUserId={session.user.id}
          hasCompletedQuestionnaire={questionnaireCompleted}
        />
      </section>

      {/* Section: Calendar */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">{t('calendarTitle')}</h2>
        <Suspense fallback={<div className="flex h-96 items-center justify-center text-muted-foreground">...</div>}>
          <LandingCalendar userId={session.user.id} />
        </Suspense>
      </section>
    </div>
  );
}
