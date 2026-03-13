import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasCompletedQuestionnaire, getActiveVersionWithStructure, getSavedDraftAnswers } from '@/server/queries/questionnaire';
import { hasCompletedPreference, getUserPreferenceLabels } from '@/server/queries/preference';
import { getUserReflections } from '@/server/queries/reflection';
import { QuestionnaireFlow } from './QuestionnaireFlow';
import { getTranslations } from 'next-intl/server';

export default async function QuestionnairePage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // If already completed, go to dashboard
  const completed = await hasCompletedQuestionnaire(session.user.id);
  if (completed) {
    redirect('/dashboard');
  }

  // Must complete preferences before questionnaire
  const hasPref = await hasCompletedPreference(session.user.id);
  if (!hasPref) {
    redirect('/preferences');
  }

  const [version, reflectionsByQuestion, savedAnswers, userPreferences, t] = await Promise.all([
    getActiveVersionWithStructure(),
    getUserReflections(session.user.id),
    getSavedDraftAnswers(session.user.id),
    getUserPreferenceLabels(session.user.id),
    getTranslations('questionnaire'),
  ]);

  if (!version) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t('notAvailable')}</h1>
        <p className="mt-2 text-muted-foreground">
          {t('notConfigured')}
        </p>
      </div>
    );
  }

  return (
    <QuestionnaireFlow
      version={version}
      reflectionsByQuestion={reflectionsByQuestion}
      savedAnswers={savedAnswers}
      userPreferences={userPreferences}
    />
  );
}
