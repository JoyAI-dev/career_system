'use client';

import { useState, useActionState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { submitQuestionnaireUpdate, type ActionState } from '@/server/actions/questionnaire';
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

type Props = {
  version: Version;
  previousAnswers: Record<string, string>;
  activityId?: string;
  activityTitle?: string;
};

export function QuestionnaireUpdateFlow({ version, previousAnswers, activityId, activityTitle }: Props) {
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(previousAnswers);
  const [state, formAction] = useActionState<ActionState, FormData>(submitQuestionnaireUpdate, {});
  const [isPending, startTransition] = useTransition();

  const topics = version.topics;
  const currentTopic = topics[currentTopicIndex];
  const isFirstTopic = currentTopicIndex === 0;
  const isLastTopic = currentTopicIndex === topics.length - 1;

  const topicQuestions = currentTopic.dimensions.flatMap((d) => d.questions);
  const allCurrentAnswered = topicQuestions.every((q) => answers[q.id]);

  const allQuestions = topics.flatMap((t) => t.dimensions.flatMap((d) => d.questions));
  const totalQuestions = allQuestions.length;
  const answeredCount = allQuestions.filter((q) => answers[q.id]).length;

  // Track which answers changed from previous
  const changedCount = Object.entries(answers).filter(
    ([qId, optId]) => previousAnswers[qId] !== optId,
  ).length;

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
        <h1 className="text-2xl font-bold tracking-tight">Update Your Cognitive Profile</h1>
        {activityTitle ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Reflect on your experience from <strong>{activityTitle}</strong> and update your answers.
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Review and update your questionnaire answers based on your recent experiences.
          </p>
        )}
        {changedCount > 0 && (
          <p className="mt-1 text-xs text-primary">
            {changedCount} answer{changedCount !== 1 ? 's' : ''} changed from previous
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
          <span>Progress</span>
          <span>{answeredCount} / {totalQuestions} questions</span>
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

      {/* Current topic content */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">{currentTopic.name}</h2>

        {currentTopic.dimensions.map((dimension) => (
          <div key={dimension.id} className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">{dimension.name}</h3>

            {dimension.questions.map((question) => {
              const wasChanged = previousAnswers[question.id] && answers[question.id] !== previousAnswers[question.id];
              return (
                <Card key={question.id} className={wasChanged ? 'ring-1 ring-primary/30' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">{question.title}</CardTitle>
                      {wasChanged && (
                        <span className="text-xs text-primary">Changed</span>
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
            Previous
          </Button>
          <Link href={activityId ? '/activities' : '/cognitive-report'}>
            <Button variant="ghost" size="sm">Cancel</Button>
          </Link>
        </div>

        {isLastTopic ? (
          <Button
            onClick={handleSubmit}
            disabled={answeredCount < totalQuestions || isPending}
          >
            {isPending ? 'Submitting...' : `Submit Update${changedCount > 0 ? ` (${changedCount} changed)` : ''}`}
          </Button>
        ) : (
          <Button
            onClick={goNext}
            disabled={!allCurrentAnswered}
          >
            Next Topic
          </Button>
        )}
      </div>
    </div>
  );
}
