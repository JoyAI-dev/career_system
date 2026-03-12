import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasCompletedPreference } from '@/server/queries/preference';
import { hasCompletedQuestionnaire } from '@/server/queries/questionnaire';
import { getAllPreferenceCategories } from '@/server/queries/preference';
import { PreferencesFlow } from './PreferencesFlow';

export default async function PreferencesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // If already completed preferences, move to next step
  const prefDone = await hasCompletedPreference(session.user.id);
  if (prefDone) {
    const questDone = await hasCompletedQuestionnaire(session.user.id);
    if (questDone) {
      redirect('/dashboard');
    }
    redirect('/questionnaire');
  }

  const categories = await getAllPreferenceCategories();

  if (!categories || categories.length === 0) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Preferences Not Available</h1>
        <p className="mt-2 text-muted-foreground">
          Preference categories have not been configured yet.
        </p>
      </div>
    );
  }

  return <PreferencesFlow categories={categories} />;
}
