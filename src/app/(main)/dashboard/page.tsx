import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import {
  getActivityProgress,
  getUserJoinedActivities,
  hasAnyVirtualGroupMembership,
  getUserFormingGroupsSummary,
  getPairingDataForStep,
} from '@/server/queries/activity';
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
  let [steps, joinedActivities, questionnaireCompleted, t] = await Promise.all([
    getActivityProgress(session.user.id),
    getUserJoinedActivities(session.user.id),
    hasCompletedQuestionnaire(session.user.id),
    getTranslations('dashboard'),
  ]);

  // ── Catch-up: auto-match users who completed questionnaire before the
  //    matching feature was deployed (or whose matching silently failed).
  //    Only runs once per affected user — after matching, they'll have
  //    virtual-group memberships and this block won't trigger again.
  if (questionnaireCompleted && joinedActivities.length === 0) {
    const hasGroups = await hasAnyVirtualGroupMembership(session.user.id);
    if (!hasGroups) {
      try {
        const { matchUserToFirstActivity } = await import(
          '@/server/services/activityMatching'
        );
        await matchUserToFirstActivity(session.user.id);
        // Re-fetch data that may have changed after matching
        [steps, joinedActivities] = await Promise.all([
          getActivityProgress(session.user.id),
          getUserJoinedActivities(session.user.id),
        ]);
      } catch (err) {
        console.error('Dashboard catch-up matching failed:', err);
      }
    }
  }

  // Check if user is in FORMING groups (waiting for more members)
  const formingGroupsSummary = questionnaireCompleted && joinedActivities.length === 0
    ? await getUserFormingGroupsSummary(session.user.id)
    : null;

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

  // Fetch pairing data when current step has no activities (PAIR_2 type needs pairing first)
  const pairingData = currentStep && currentActivities.length === 0
    ? await getPairingDataForStep(session.user.id, currentStep.typeId)
    : null;

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
          formingGroupsSummary={formingGroupsSummary}
          pairingData={pairingData}
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
