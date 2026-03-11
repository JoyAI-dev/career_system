'use client';

import { useState, useActionState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { submitQuestionnaire, type ActionState } from '@/server/actions/questionnaire';
import { DimensionNav } from '@/components/DimensionNav';

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

type Topic = {
  id: string;
  name: string;
  order: number;
  dimensions: Dimension[];
};

type Version = {
  id: string;
  version: number;
  topics: Topic[];
};

export function QuestionnaireFlow({ version }: { version: Version }) {
  const t = useTranslations('questionnaire');
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [state, formAction] = useActionState<ActionState, FormData>(submitQuestionnaire, {});
  const [isPending, startTransition] = useTransition();

  const topics = version.topics;
  const currentTopic = topics[currentTopicIndex];
  const isFirstTopic = currentTopicIndex === 0;
  const isLastTopic = currentTopicIndex === topics.length - 1;

  // Get all questions for the current topic
  const topicQuestions = currentTopic.dimensions.flatMap((d) => d.questions);

  // Check if all questions in current topic are answered
  const allCurrentAnswered = topicQuestions.every((q) => answers[q.id]);

  // Get total question count and answered count
  const allQuestions = topics.flatMap((t) => t.dimensions.flatMap((d) => d.questions));
  const totalQuestions = allQuestions.length;
  const answeredCount = Object.keys(answers).length;

  function selectAnswer(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  }

  function goNext() {
    if (currentTopicIndex < topics.length - 1) {
      setCurrentTopicIndex((i) => i + 1);
    }
  }

  function goPrev() {
    if (currentTopicIndex > 0) {
      setCurrentTopicIndex((i) => i - 1);
    }
  }

  function handleSubmit() {
    const formData = new FormData();
    formData.set('versionId', version.id);
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
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('description')}
        </p>
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
          const topicQs = topic.dimensions.flatMap((d) => d.questions);
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
        dimensions={currentTopic.dimensions.map((d) => ({ id: d.id, name: d.name }))}
      />

      {/* Current topic content */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">{currentTopic.name}</h2>

        {currentTopic.dimensions.map((dimension) => (
          <div key={dimension.id} id={`dimension-${dimension.id}`} className="scroll-mt-24 space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">{dimension.name}</h3>

            {dimension.questions.map((question) => (
              <Card key={question.id}>
                <CardHeader>
                  <CardTitle className="text-sm">{question.title}</CardTitle>
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
                </CardContent>
              </Card>
            ))}
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
        <Button
          variant="outline"
          onClick={goPrev}
          disabled={isFirstTopic}
        >
          {t('previous')}
        </Button>

        {isLastTopic ? (
          <Button
            onClick={handleSubmit}
            disabled={answeredCount < totalQuestions || isPending}
          >
            {isPending ? t('submitting') : t('submit')}
          </Button>
        ) : (
          <Button
            onClick={goNext}
            disabled={!allCurrentAnswered}
          >
            {t('nextTopic')}
          </Button>
        )}
      </div>
    </div>
  );
}
