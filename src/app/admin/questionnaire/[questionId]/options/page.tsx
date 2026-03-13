import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';
import { getQuestionWithOptions } from '@/server/queries/questionnaire';
import { AnswerOptionsEditor } from './AnswerOptionsEditor';

export default async function AnswerOptionsPage({
  params,
}: {
  params: Promise<{ questionId: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect('/');
  }

  const { questionId } = await params;
  const question = await getQuestionWithOptions(questionId);

  if (!question) {
    redirect('/admin/questionnaire');
  }

  const version = question.dimension.subTopic.topic.version;
  const isDraft = !version.isActive;
  const t = await getTranslations('admin.questionnaire.options');

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/questionnaire"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; {t('backToQuestionnaire')}
        </Link>
      </div>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">
        {t('title')}
      </h1>
      <p className="mb-6 text-muted-foreground">
        <span className="font-medium">{question.dimension.subTopic.topic.name}</span>
        {' > '}
        <span className="font-medium">{question.dimension.name}</span>
        {' > '}
        <span className="font-medium">{question.title}</span>
      </p>
      <AnswerOptionsEditor
        questionId={question.id}
        options={question.answerOptions}
        isDraft={isDraft}
        versionNumber={version.version}
      />
    </div>
  );
}
