import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasCompletedQuestionnaire, getActiveVersionWithStructure } from '@/server/queries/questionnaire';
import { QuestionnaireFlow } from './QuestionnaireFlow';

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

  const version = await getActiveVersionWithStructure();
  if (!version) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">Questionnaire Not Available</h1>
        <p className="mt-2 text-muted-foreground">
          No active questionnaire is currently configured. Please contact an administrator.
        </p>
      </div>
    );
  }

  return <QuestionnaireFlow version={version} />;
}
