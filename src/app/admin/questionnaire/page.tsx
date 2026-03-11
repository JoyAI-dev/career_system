import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import {
  getQuestionnaireVersions,
  getVersionStructure,
} from '@/server/queries/questionnaire';
import { QuestionnaireManager } from './QuestionnaireManager';

export default async function AdminQuestionnairePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const versions = await getQuestionnaireVersions();

  // Load the active version structure, or the latest draft, or null
  const activeVersion = versions.find((v: { isActive: boolean }) => v.isActive);
  const draftVersion = versions.find((v: { isActive: boolean }) => !v.isActive);
  const selectedVersion = draftVersion ?? activeVersion;

  const [structure, t] = await Promise.all([
    selectedVersion ? getVersionStructure(selectedVersion.id) : Promise.resolve(null),
    getTranslations('admin.questionnaire'),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">
        {t('title')}
      </h1>
      <QuestionnaireManager
        versions={versions}
        initialStructure={structure}
        initialVersionId={selectedVersion?.id ?? null}
      />
    </div>
  );
}
