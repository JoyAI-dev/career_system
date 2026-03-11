import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { auth } from '@/lib/auth';
import { getActivityProgress } from '@/server/queries/activity';
import { getUserActivities } from '@/server/queries/activity';
import { getActivityTypes } from '@/server/queries/activityType';
import { getTags } from '@/server/queries/tag';
import { ActivityStepper } from '@/components/ActivityStepper';
import { ActivityBrowser } from '@/app/(main)/activities/ActivityBrowser';
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
  const [steps, activities, types, tags, t] = await Promise.all([
    getActivityProgress(session.user.id),
    getUserActivities(session.user.id),
    getActivityTypes(),
    getTags(),
    getTranslations('dashboard'),
  ]);

  const enabledTypes = types.filter((ty) => ty.isEnabled);

  return (
    <div className="space-y-8">
      {/* Section: Progress Stepper */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">{t('journeyTitle')}</h2>
        <div className="rounded-xl bg-white p-4 shadow-sm md:p-6">
          <ActivityStepper steps={steps} />
        </div>
      </section>

      {/* Section: Available Activities with Filters */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">{t('availableActivities')}</h2>
        <ActivityBrowser
          activities={JSON.parse(JSON.stringify(activities))}
          types={enabledTypes.map((ty) => ({ id: ty.id, name: ty.name }))}
          tags={tags.map((tg) => ({ id: tg.id, name: tg.name }))}
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
