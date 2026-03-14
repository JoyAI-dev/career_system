'use client';

import { useState, useActionState, useTransition, useMemo, useRef, useEffect, useCallback } from 'react';
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
import { submitQuestionnaire, submitQuestionnaireUpdate, saveQuestionnaireDraft, type ActionState } from '@/server/actions/questionnaire';
import { DimensionNav } from '@/components/DimensionNav';
import { QuestionReflections } from '@/components/QuestionReflections';
import Link from 'next/link';
import {
  type Question,
  type Topic,
  type UserPreferences,
  getVisibleContent,
  getAnswerKey,
  getExpectedAnswerCount,
  getAnsweredCount,
  getUnansweredQuestions,
  shouldShowSubTopicSections,
  shouldShowSubTopicTabs,
  buildSubTopicGroups,
  getGroupAnsweredCount,
  formatPercent,
  findFirstUnanswered,
} from './questionnaire-helpers';

type Version = {
  id: string;
  version: number;
  topics: Topic[];
};

type ReflectionItem = { id: string; content: string; activityTag: string | null; createdAt: string };

// ─── Component ────────────────────────────────────────────────────────

export function QuestionnaireFlow({
  version,
  reflectionsByQuestion = {},
  savedAnswers = {},
  userPreferences = {},
  // Update mode props
  mode = 'initial',
  previousAnswers,
  activityId,
  activityTitle,
  activityStage,
}: {
  version: Version;
  reflectionsByQuestion?: Record<string, ReflectionItem[]>;
  savedAnswers?: Record<string, string>;
  userPreferences?: UserPreferences;
  mode?: 'initial' | 'update';
  previousAnswers?: Record<string, string>;
  activityId?: string;
  activityTitle?: string;
  activityStage?: string;
}) {
  const isUpdate = mode === 'update';
  const t = useTranslations('questionnaire');
  const tUpdate = useTranslations('questionnaire.update');
  const tCommon = useTranslations('common');
  const [answers, setAnswers] = useState<Record<string, string>>(savedAnswers);
  const [state, formAction] = useActionState<ActionState, FormData>(
    isUpdate ? submitQuestionnaireUpdate : submitQuestionnaire, {}
  );
  const [saveState, saveDraftAction] = useActionState<ActionState, FormData>(saveQuestionnaireDraft, {});
  const [isPending, startTransition] = useTransition();
  const [isSaving, startSavingTransition] = useTransition();
  // Auto-save toast state: idle → saving → saved/error → idle
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [unansweredDialogOpen, setUnansweredDialogOpen] = useState(false);
  const [unansweredItems, setUnansweredItems] = useState<{ question: Question; answerKey: string; instanceLabel?: string }[]>([]);
  const [isSubmitAttempt, setIsSubmitAttempt] = useState(false);
  // For REPEAT mode: track which tab is active per topic
  const [activeRepeatTab, setActiveRepeatTab] = useState<Record<string, number>>({});

  // Change tracking (update mode only)
  const changedCount = useMemo(() => {
    if (!isUpdate || !previousAnswers) return 0;
    return Object.entries(answers).filter(([k, v]) => previousAnswers[k] !== v).length;
  }, [isUpdate, previousAnswers, answers]);

  // Compute visible topics (skip topics with no visible content)
  const visibleTopics = useMemo(() => {
    return version.topics.filter(topic => {
      const content = getVisibleContent(topic, userPreferences);
      if (content.questions.length === 0) return false;
      if (content.mode === 'REPEAT' && content.repeatInstances.length === 0) return false;
      return true;
    });
  }, [version.topics, userPreferences]);

  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const currentTopic = visibleTopics[currentTopicIndex];
  const isFirstTopic = currentTopicIndex === 0;
  const isLastTopic = currentTopicIndex === visibleTopics.length - 1;

  // Current topic's visible content
  const currentContent = useMemo(
    () => currentTopic ? getVisibleContent(currentTopic, userPreferences) : null,
    [currentTopic, userPreferences]
  );

  // Progress calculations
  const totalExpected = useMemo(() => {
    return visibleTopics.reduce((sum, topic) => {
      return sum + getExpectedAnswerCount(getVisibleContent(topic, userPreferences));
    }, 0);
  }, [visibleTopics, userPreferences]);

  const totalAnswered = useMemo(() => {
    return visibleTopics.reduce((sum, topic) => {
      return sum + getAnsweredCount(getVisibleContent(topic, userPreferences), answers);
    }, 0);
  }, [visibleTopics, userPreferences, answers]);

  const sectionExpected = currentContent ? getExpectedAnswerCount(currentContent) : 0;
  const sectionAnswered = currentContent ? getAnsweredCount(currentContent, answers) : 0;

  // ─── Auto-save: debounced save after each answer selection ───────────
  // (All hooks must be called before any early return)
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answersRef = useRef(answers);
  const prevIsSavingRef = useRef(false);

  // Keep answersRef in sync with answers state (via effect, not during render)
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  // Detect when isSaving transitions from true → false (save completed)
  // We use queueMicrotask to avoid calling setState synchronously in the effect body
  useEffect(() => {
    if (prevIsSavingRef.current && !isSaving) {
      queueMicrotask(() => {
        // Transition ended: check result
        if (saveState?.errors && Object.keys(saveState.errors).length > 0) {
          setSaveStatus('error');
        } else {
          setSaveStatus('saved');
        }
        // Auto-dismiss after 1s
        dismissTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1000);
      });
    }
    prevIsSavingRef.current = isSaving;
  }, [isSaving, saveState]);

  const doAutoSave = useCallback(() => {
    if (Object.keys(answersRef.current).length === 0) return;
    const formData = new FormData();
    formData.set('versionId', version.id);
    for (const [answerKey, optionId] of Object.entries(answersRef.current)) {
      if (answerKey.includes('::')) {
        const [questionId, prefOptionId] = answerKey.split('::');
        formData.set(`repeat_${questionId}_${prefOptionId}`, optionId);
      } else {
        formData.set(`answer_${answerKey}`, optionId);
      }
    }
    setSaveStatus('saving');
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    startSavingTransition(() => {
      saveDraftAction(formData);
    });
  }, [version.id, saveDraftAction, startSavingTransition]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  // Use helpers for SubTopic section visibility and navigation
  const showSections = currentContent ? shouldShowSubTopicSections(currentContent) : false;
  const showTabs = currentContent ? shouldShowSubTopicTabs(currentContent) : false;

  // Build groups for vertical tab navigation (only used when showTabs is true)
  const subTopicGroups = useMemo(() => {
    if (!showTabs || !currentContent) return undefined;
    return buildSubTopicGroups(currentContent).map(g => ({
      ...g,
      answeredCount: getGroupAnsweredCount(g, answers),
      totalCount: g.questionIds.length,
    }));
  }, [showTabs, currentContent, answers]);

  // Flat dimensions for single-group mode
  const flatDimensions = useMemo(() => {
    if (showTabs || !currentContent) return [];
    return currentContent.dimensions.map(d => ({ id: d.id, name: d.name }));
  }, [showTabs, currentContent]);

  if (!currentTopic || !currentContent) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold">{t('notAvailable')}</h1>
      </div>
    );
  }

  function selectAnswer(answerKey: string, optionId: string) {
    setAnswers(prev => ({ ...prev, [answerKey]: optionId }));
    // Debounce auto-save: wait 1s after last click before saving
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(doAutoSave, 1000);
  }

  function scrollToQuestion(answerKey: string) {
    setUnansweredDialogOpen(false);
    setTimeout(() => {
      const el = document.getElementById(`question-${answerKey}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }

  function handleNext() {
    if (!currentContent) return;
    const unanswered = getUnansweredQuestions(currentContent, answers);
    if (unanswered.length > 0) {
      setUnansweredItems(unanswered);
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
    if (currentTopicIndex < visibleTopics.length - 1) {
      setCurrentTopicIndex(i => i + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function goPrev() {
    if (currentTopicIndex > 0) {
      setCurrentTopicIndex(i => i - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function buildFormData() {
    const formData = new FormData();
    formData.set('versionId', version.id);
    // In update mode, include activityId if provided
    if (isUpdate && activityId) {
      formData.set('activityId', activityId);
    }
    for (const [answerKey, optionId] of Object.entries(answers)) {
      if (answerKey.includes('::')) {
        // REPEAT: answerKey = questionId::prefOptionId
        const [questionId, prefOptionId] = answerKey.split('::');
        formData.set(`repeat_${questionId}_${prefOptionId}`, optionId);
      } else {
        formData.set(`answer_${answerKey}`, optionId);
      }
    }
    return formData;
  }

  function handleSave() {
    if (Object.keys(answers).length === 0) return;
    const formData = buildFormData();
    setSaveStatus('saving');
    if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    startSavingTransition(() => {
      saveDraftAction(formData);
    });
  }

  function doSubmit() {
    // Cancel any pending auto-save to avoid unnecessary server work
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    const formData = buildFormData();
    startTransition(() => {
      formAction(formData);
    });
  }

  function handleSubmit() {
    // Check all visible topics for unanswered questions
    const allUnanswered: { question: Question; answerKey: string; instanceLabel?: string }[] = [];
    for (const topic of visibleTopics) {
      const content = getVisibleContent(topic, userPreferences);
      allUnanswered.push(...getUnansweredQuestions(content, answers));
    }
    if (allUnanswered.length > 0) {
      setUnansweredItems(allUnanswered);
      setIsSubmitAttempt(true);
      setUnansweredDialogOpen(true);
      return;
    }
    doSubmit();
  }

  // Helper: check if a specific answer was changed from previous (update mode)
  function isAnswerChanged(answerKey: string): boolean {
    if (!isUpdate || !previousAnswers) return false;
    return previousAnswers[answerKey] !== undefined && answers[answerKey] !== previousAnswers[answerKey];
  }

  // Submit button label
  const submitLabel = isUpdate
    ? (changedCount > 0 ? tUpdate('submitUpdateWithCount', { count: changedCount }) : tUpdate('submitUpdate'))
    : t('submit');

  // Get current REPEAT tab index for current topic
  const currentRepeatTabIdx = activeRepeatTab[currentTopic.id] ?? 0;
  const currentRepeatInstance = currentContent.mode === 'REPEAT'
    ? currentContent.repeatInstances[currentRepeatTabIdx]
    : null;

  return (
    <div>
      {/* Auto-save toast — fixed top-left, non-intrusive, 3 states */}
      {saveStatus !== 'idle' && (
        <div className="fixed left-4 top-4 z-50 animate-in fade-in slide-in-from-left-2 duration-200">
          {saveStatus === 'saving' && (
            <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 shadow-sm ring-1 ring-blue-200/60">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="8" cy="8" r="6" strokeOpacity="0.3" />
                <path d="M8 2a6 6 0 014.243 10.243" strokeLinecap="round" />
              </svg>
              {t('saving')}
            </div>
          )}
          {saveStatus === 'saved' && (
            <div className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 shadow-sm ring-1 ring-green-200/60">
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zm3.354-9.354a.5.5 0 00-.708-.708L7 8.586 5.354 6.94a.5.5 0 10-.708.708l2 2a.5.5 0 00.708 0l4-4z" />
              </svg>
              {t('saved')}
            </div>
          )}
          {saveStatus === 'error' && (
            <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 shadow-sm ring-1 ring-red-200/60">
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M8 15A7 7 0 108 1a7 7 0 000 14zM5.354 5.354a.5.5 0 01.707 0L8 7.293l1.94-1.94a.5.5 0 01.707.708L8.707 8l1.94 1.94a.5.5 0 01-.708.707L8 8.707l-1.94 1.94a.5.5 0 01-.707-.708L7.293 8 5.354 6.06a.5.5 0 010-.707z" />
              </svg>
              {t('saveFailed')}
            </div>
          )}
        </div>
      )}

      {/* Header — mode-specific */}
      {isUpdate ? (
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">{tUpdate('title')}</h1>
          {activityTitle ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {tUpdate.rich('descriptionWithActivity', {
                activity: activityTitle,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </p>
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
      ) : (
        <>
          <div className="mb-4 text-center">
            <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          </div>
          <div className="mb-6 whitespace-pre-line rounded-lg bg-muted/50 p-4 text-sm leading-relaxed text-muted-foreground">
            {t('description')}
          </div>
        </>
      )}

      {/* Total progress bar */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between text-sm text-muted-foreground">
          <span>{t('totalProgress')}</span>
          <span>
            {t('questionsCount', { answered: totalAnswered, total: totalExpected })}
            {' '}
            <span className="font-medium tabular-nums">
              ({formatPercent(totalAnswered, totalExpected)})
            </span>
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-300 ${totalAnswered === totalExpected && totalExpected > 0 ? 'bg-green-500' : 'bg-primary'}`}
            style={{ width: `${totalExpected > 0 ? (totalAnswered / totalExpected) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Topic stepper tabs — wrap to multiple lines, with completion % */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {visibleTopics.map((topic, idx) => {
          const content = getVisibleContent(topic, userPreferences);
          const expected = getExpectedAnswerCount(content);
          const answered = getAnsweredCount(content, answers);
          const topicComplete = expected > 0 && answered >= expected;
          const isCurrent = idx === currentTopicIndex;
          const pct = formatPercent(answered, expected);

          return (
            <button
              key={topic.id}
              onClick={() => {
                setCurrentTopicIndex(idx);
                // If clicking the current topic, jump to first unanswered question
                if (idx === currentTopicIndex) {
                  const firstUnanswered = findFirstUnanswered(content, answers);
                  if (firstUnanswered) {
                    setTimeout(() => {
                      const el = document.getElementById(`question-${firstUnanswered}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                  }
                } else {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                isCurrent
                  ? 'bg-primary text-primary-foreground'
                  : topicComplete
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {idx + 1}. {topic.name}
              <span className={`ml-1 text-[10px] tabular-nums ${
                isCurrent ? 'opacity-80' : topicComplete ? 'text-green-600' : 'opacity-50'
              }`}>
                {pct}
              </span>
            </button>
          );
        })}
      </div>

      {/* REPEAT mode: instance tabs */}
      {currentContent.mode === 'REPEAT' && currentContent.repeatInstances.length > 0 && (
        <div className="mb-4 flex gap-1 overflow-x-auto rounded-lg bg-muted/50 p-1">
          {currentContent.repeatInstances.map((inst, idx) => {
            const isActive = idx === currentRepeatTabIdx;
            const instAnswered = currentContent.questions.filter(
              q => answers[getAnswerKey(q.id, 'REPEAT', inst.id)]
            ).length;
            const instTotal = currentContent.questions.length;
            return (
              <button
                key={inst.id}
                onClick={() => setActiveRepeatTab(prev => ({ ...prev, [currentTopic.id]: idx }))}
                className={`flex-shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {inst.label}
                <span className="ml-1.5 text-xs opacity-60">
                  {instAnswered}/{instTotal}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* CONTEXT/FILTER mode: preference labels */}
      {(currentContent.mode === 'CONTEXT' || currentContent.mode === 'FILTER') && currentContent.contextLabels.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('yourSelection')}:</span>
          {currentContent.contextLabels.map(label => (
            <span key={label} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Dimension navigation with integrated section progress */}
      <DimensionNav
        dimensions={flatDimensions}
        groups={subTopicGroups}
        sectionAnswered={sectionAnswered}
        sectionTotal={sectionExpected}
      />

      {/* Current topic content */}
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">{currentTopic.name}</h2>

        {currentContent.mode === 'REPEAT' && currentRepeatInstance ? (
          // REPEAT: render template questions for the active tab
          currentContent.dimensions.map(dimension => (
            <div key={`${dimension.id}-${currentRepeatInstance.id}`} id={`dimension-${dimension.id}`} className="scroll-mt-56 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">{dimension.name}</h3>
              {dimension.questions.map(question => {
                const answerKey = getAnswerKey(question.id, 'REPEAT', currentRepeatInstance.id);
                return (
                  <QuestionCard
                    key={answerKey}
                    question={question}
                    answerKey={answerKey}
                    selectedOptionId={answers[answerKey]}
                    onSelect={selectAnswer}
                    reflections={reflectionsByQuestion[question.id] ?? []}
                    wasChanged={isAnswerChanged(answerKey)}
                    changedLabel={tUpdate('changed')}
                    activityTag={isUpdate ? (activityStage ?? activityTitle) : undefined}
                    showReflections={isUpdate}
                  />
                );
              })}
            </div>
          ))
        ) : showSections ? (
          // FILTER (always) or CONTEXT with multiple SubTopics: render each SubTopic as a labeled section
          currentContent.subTopics.map(subTopic => (
            <div key={subTopic.id} className="space-y-4">
              <h3 className="border-l-4 border-primary pl-3 text-base font-medium text-primary">
                {subTopic.name}
              </h3>
              {subTopic.dimensions.map(dimension => (
                <div key={dimension.id} id={`dimension-${dimension.id}`} className="scroll-mt-56 space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">{dimension.name}</h4>
                  {dimension.questions.map(question => (
                    <QuestionCard
                      key={question.id}
                      question={question}
                      answerKey={question.id}
                      selectedOptionId={answers[question.id]}
                      onSelect={selectAnswer}
                      reflections={reflectionsByQuestion[question.id] ?? []}
                      wasChanged={isAnswerChanged(question.id)}
                      changedLabel={tUpdate('changed')}
                      activityTag={isUpdate ? (activityStage ?? activityTitle) : undefined}
                      showReflections={isUpdate}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))
        ) : (
          // Single SubTopic (CONTEXT with 1 SubTopic): render dimensions directly
          currentContent.dimensions.map(dimension => (
            <div key={dimension.id} id={`dimension-${dimension.id}`} className="scroll-mt-56 space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">{dimension.name}</h3>
              {dimension.questions.map(question => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  answerKey={question.id}
                  selectedOptionId={answers[question.id]}
                  onSelect={selectAnswer}
                  reflections={reflectionsByQuestion[question.id] ?? []}
                  wasChanged={isAnswerChanged(question.id)}
                  changedLabel={tUpdate('changed')}
                  activityTag={isUpdate ? (activityStage ?? activityTitle) : undefined}
                  showReflections={isUpdate}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Error display */}
      {state.errors && (
        <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {Object.values(state.errors).flat().join('. ')}
        </div>
      )}

      {/* Navigation — mode-specific */}
      <div className="mt-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={isFirstTopic}
          >
            {t('previous')}
          </Button>
          {isUpdate && (
            <Link href={activityId ? '/activities' : '/cognitive-report'}>
              <Button variant="ghost" size="sm">{tCommon('cancel')}</Button>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={handleSave}
            disabled={isSaving || Object.keys(answers).length === 0}
          >
            {isSaving ? t('saving') : t('save')}
          </Button>

          {/* Update mode: early submit button on non-last topics */}
          {isUpdate && !isLastTopic && (
            <Button variant="outline" onClick={handleSubmit} disabled={isPending}>
              {isPending ? t('submitting') : submitLabel}
            </Button>
          )}

          {isLastTopic ? (
            <Button
              onClick={handleSubmit}
              disabled={isPending || Object.keys(answers).length === 0}
            >
              {isPending ? t('submitting') : submitLabel}
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
              {t('unansweredDescription', { count: unansweredItems.length })}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-60 space-y-1 overflow-y-auto">
            {unansweredItems.map(item => (
              <button
                key={item.answerKey}
                onClick={() => scrollToQuestion(item.answerKey)}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-primary hover:bg-muted"
              >
                {item.instanceLabel && (
                  <span className="mr-1 text-xs text-muted-foreground">[{item.instanceLabel}]</span>
                )}
                {item.question.title}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnansweredDialogOpen(false)}>
              {t('goBack')}
            </Button>
            {isSubmitAttempt ? (
              // In update mode, don't allow "Submit Anyway" — only "Go Back"
              !isUpdate && (
                <Button onClick={() => { setUnansweredDialogOpen(false); doSubmit(); }}>
                  {t('submitAnyway')}
                </Button>
              )
            ) : (
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

// ─── QuestionCard Component ───────────────────────────────────────────

function QuestionCard({
  question,
  answerKey,
  selectedOptionId,
  onSelect,
  reflections,
  wasChanged,
  changedLabel,
  activityTag,
  showReflections = false,
}: {
  question: Question;
  answerKey: string;
  selectedOptionId?: string;
  onSelect: (answerKey: string, optionId: string) => void;
  reflections: ReflectionItem[];
  wasChanged?: boolean;
  changedLabel?: string;
  activityTag?: string;
  showReflections?: boolean;
}) {
  return (
    <Card id={`question-${answerKey}`} className={`scroll-mt-60 ${wasChanged ? 'ring-1 ring-primary/30' : ''}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{question.title}</CardTitle>
          {wasChanged && changedLabel && (
            <span className="text-xs text-primary">{changedLabel}</span>
          )}
        </div>
        {question.notes.length > 0 && (
          <CardDescription>
            {question.notes.map(note => (
              <span key={note.id} className="block text-xs">
                <strong>{note.label}:</strong> {note.content}
              </span>
            ))}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {question.answerOptions.map(option => {
            const isSelected = selectedOptionId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onSelect(answerKey, option.id)}
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
        {showReflections && (
          <QuestionReflections
            questionId={question.id}
            initialReflections={reflections}
            activityTag={activityTag}
          />
        )}
      </CardContent>
    </Card>
  );
}
