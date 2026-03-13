'use client';

import { useState, useActionState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { submitQuestionnaireUpdate, type ActionState } from '@/server/actions/questionnaire';
import { DimensionNav } from '@/components/DimensionNav';
import { SectionProgress } from '@/components/SectionProgress';
import { QuestionReflections } from '@/components/QuestionReflections';
import Link from 'next/link';

type AnswerOption = {
  id: string;
  label: string;
  score: number;
  order: number;
};

type QuestionNote = {
  id: string;
  label: string;
  content: string;
};

type Question = {
  id: string;
  title: string;
  order: number;
  notes: QuestionNote[];
  answerOptions: AnswerOption[];
};

type Dimension = {
  id: string;
  name: string;
  order: number;
  questions: Question[];
};

type SubTopic = {
  id: string;
  name: string;
  order: number;
  dimensions: Dimension[];
};

type Topic = {
  id: string;
  name: string;
  order: number;
  subTopics: SubTopic[];
};

type Version = {
  id: string;
  version: number;
  topics: Topic[];
};

type ReflectionItem = { id: string; content: string; activityTag: string | null; createdAt: string };

type Props = {
  version: Version;
  previousAnswers: Record<string, string>;
  activityId?: string;
  activityTitle?: string;
  activityStage?: string;
  reflectionsByQuestion?: Record<string, ReflectionItem[]>;
};

export function QuestionnaireUpdateFlow({
  version,
  previousAnswers,
  activityId,
  activityTitle,
  activityStage,
  reflectionsByQuestion = {},
}: Props) {
  const t = useTranslations('questionnaire');
  const tUpdate = useTranslations('questionnaire.update');
  const tCommon = useTranslations('common');
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(previousAnswers);
  const [state, formAction] = useActionState<ActionState, FormData>(submitQuestionnaireUpdate, {});
  const [isPending, startTransition] = useTransition();
  const [unansweredDialogOpen, setUnansweredDialogOpen] = useState(false);
  const [unansweredQuestions, setUnansweredQuestions] = useState<Question[]>([]);
  const [isSubmitAttempt, setIsSubmitAttempt] = useState(false);

  const topics = version.topics;
  const currentTopic = topics[currentTopicIndex];
  const isFirstTopic = currentTopicIndex === 0;
  const isLastTopic = currentTopicIndex === topics.length - 1;

  const topicDimensions = currentTopic.subTopics.flatMap((st) => st.dimensions);
  const topicQuestions = topicDimensions.flatMap((d) => d.questions);
  const allQuestions = topics.flatMap((t) => t.subTopics.flatMap((st) => st.dimensions.flatMap((d) => d.questions)));
  const totalQuestions = allQuestions.length;
  const answeredCount = allQuestions.filter((q) => answers[q.id]).length;

  // Section progress
  const sectionAnswered = topicQuestions.filter((q) => answers[q.id]).length;
  const sectionTotal = topicQuestions.length;

  const changedCount = Object.entries(answers).filter(
    ([qId, optId]) => previousAnswers[qId] !== optId,
  ).length;

  function selectAnswer(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function scrollToQuestion(questionId: string) {
    setUnansweredDialogOpen(false);
    setTimeout(() => {
      const el = document.getElementById(`question-${questionId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  function handleNext() {
    const unanswered = topicQuestions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      setUnansweredQuestions(unanswered);
      setIsSubmitAttempt(false);
      setUnansweredDialogOpen(true);
    } else {
      goNext();
    }
  }

  function handleContinueAnyway() {
    setUnansweredDialogOpen(false);
    goNext();
  }

  function goNext() {
    if (currentTopicIndex < topics.length - 1) {
      setCurrentTopicIndex((i) => i + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goPrev() {
    if (currentTopicIndex > 0) {
      setCurrentTopicIndex((i) => i - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function handleSubmit() {
    const allUnanswered = allQuestions.filter((q) => !answers[q.id]);
    if (allUnanswered.length > 0) {
      setUnansweredQuestions(allUnanswered);
      setIsSubmitAttempt(true);
      setUnansweredDialogOpen(true);
      return;
    }

    const formData = new FormData();
    formData.set('versionId', version.id);
    if (activityId) formData.set('activityId', activityId);
    for (const [questionId, optionId] of Object.entries(answers)) {
      formData.set(`answer_${questionId}`, optionId);
    }
    startTransition(() => {
      formAction(formData);
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">{tUpdate('title')}</h1>
        {activityTitle ? (
          <p
            className="mt-1 text-sm text-muted-foreground"
            dangerouslySetInnerHTML={{
              __html: tUpdate('descriptionWithActivity', { activity: activityTitle }),
            }}
          />
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {tUpdate('descriptionGeneric')}
          </p>
        )}
        {changedCount > 0 && (
          <p className="mt-1 text-xs text-primary">
            {tUpdate('answersChanged', { count: changedCount })}
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('progress')}</span>
          <span>{t('questionsCount', { answered: answeredCount, total: totalQuestions })}</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Topic stepper tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto">
        {topics.map((topic, idx) => {
          const topicQs = topic.subTopics.flatMap((st) => st.dimensions.flatMap((d) => d.questions));
          const topicAnswered = topicQs.every((q) => answers[q.id]);
          const isCurrent = idx === currentTopicIndex;

          return (
            <button
              key={topic.id}
              onClick={() => setCurrentTopicIndex(idx)}
              className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : topicAnswered
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {idx + 1}. {topic.name}
            </button>
          );
        })}
      </div>

      {/* Dimension navigation */}
      <DimensionNav
        dimensions={topicDimensions.map((d) => ({ id: d.id, name: d.name }))}
      />

      {/* Floating section progress */}
      <SectionProgress
        answered={sectionAnswered}
        total={sectionTotal}
        label={t('questionsCount', { answered: sectionAnswered, total: sectionTotal })}
      />

      {/* Current topic content */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">{currentTopic.name}</h2>

        {topicDimensions.map((dimension) => (
          <div key={dimension.id} id={`dimension-${dimension.id}`} className="scroll-mt-24 space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">{dimension.name}</h3>

            {dimension.questions.map((question) => {
              const wasChanged = previousAnswers[question.id] && answers[question.id] !== previousAnswers[question.id];
              return (
                <Card key={question.id} id={`question-${question.id}`} className={`scroll-mt-28 ${wasChanged ? 'ring-1 ring-primary/30' : ''}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{question.title}</CardTitle>
                      {wasChanged && (
                        <span className="text-xs text-primary">{tUpdate('changed')}</span>
                      )}
                    </div>
                    {question.notes.length > 0 && (
                      <CardDescription>
                        {question.notes.map((note) => (
                          <span key={note.id} className="block text-xs">
                            <strong>{note.label}:</strong> {note.content}
                          </span>
                        ))}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {question.answerOptions.map((option) => {
                        const isSelected = answers[question.id] === option.id;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => selectAnswer(question.id, option.id)}
                            className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                              isSelected
                                ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                                : 'border-border bg-background text-foreground hover:border-primary/50 hover:bg-muted/50'
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                    <QuestionReflections
                      questionId={question.id}
                      initialReflections={reflectionsByQuestion[question.id] ?? []}
                      activityTag={activityStage ?? activityTitle}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
      </div>

      {/* Error display */}
      {state.errors && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {Object.values(state.errors).flat().join('. ')}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={isFirstTopic}
          >
            {t('previous')}
          </Button>
          <Link href={activityId ? '/activities' : '/cognitive-report'}>
            <Button variant="ghost" size="sm">{tCommon('cancel')}</Button>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {!isLastTopic && (
            <Button variant="outline" onClick={handleSubmit} disabled={isPending}>
              {isPending ? t('submitting') : changedCount > 0 ? tUpdate('submitUpdateWithCount', { count: changedCount }) : tUpdate('submitUpdate')}
            </Button>
          )}
          {isLastTopic ? (
            <Button
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? t('submitting') : changedCount > 0 ? tUpdate('submitUpdateWithCount', { count: changedCount }) : tUpdate('submitUpdate')}
            </Button>
          ) : (
            <Button onClick={handleNext}>
              {t('nextTopic')}
            </Button>
          )}
        </div>
      </div>

      {/* Unanswered Questions Dialog */}
      <Dialog open={unansweredDialogOpen} onOpenChange={setUnansweredDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('unansweredTitle')}</DialogTitle>
            <DialogDescription>
              {t('unansweredDescription', { count: unansweredQuestions.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {unansweredQuestions.map((q) => (
              <button
                key={q.id}
                onClick={() => scrollToQuestion(q.id)}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-primary hover:bg-muted"
              >
                {q.title}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnansweredDialogOpen(false)}>
              {t('goBack')}
            </Button>
            {!isSubmitAttempt && (
              <Button onClick={handleContinueAnyway}>
                {t('continueAnyway')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
