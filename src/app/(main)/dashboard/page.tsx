import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getActivityProgress } from '@/server/queries/activity';
import { getUserJoinedActivities } from '@/server/queries/activity';
import { ActivityStepper } from '@/components/ActivityStepper';
import { ActivityCardsRow } from '@/components/ActivityCardsRow';
import { LandingCalendar } from '@/components/LandingCalendar';

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
  const [steps, joinedActivities, t] = await Promise.all([
    getActivityProgress(session.user.id),
    getUserJoinedActivities(session.user.id),
    getTranslations('dashboard'),
  ]);

  return (
    <div className="space-y-8">
      {/* Section: Progress Stepper */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">{t('journeyTitle')}</h2>
        <div className="rounded-xl bg-white p-4 shadow-sm md:p-6">
          <ActivityStepper steps={steps} />
        </div>
      </section>

      {/* Section: Joined Activity Cards */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">{t('myActivities')}</h2>
        <ActivityCardsRow activities={JSON.parse(JSON.stringify(joinedActivities))} />
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
