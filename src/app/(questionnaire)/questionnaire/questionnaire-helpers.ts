/**
 * Pure helper functions for questionnaire rendering logic.
 * Extracted from QuestionnaireFlow.tsx for testability.
 */

// ─── Types ────────────────────────────────────────────────────────────

export type AnswerOption = {
  id: string;
  label: string;
  score: number;
  order: number;
};

export type QuestionNote = {
  id: string;
  label: string;
  content: string;
};

export type Question = {
  id: string;
  title: string;
  order: number;
  notes: QuestionNote[];
  answerOptions: AnswerOption[];
};

export type Dimension = {
  id: string;
  name: string;
  order: number;
  questions: Question[];
};

export type SubTopic = {
  id: string;
  name: string;
  order: number;
  preferenceOptionId: string | null;
  dimensions: Dimension[];
};

export type Topic = {
  id: string;
  name: string;
  order: number;
  preferenceMode: string;
  showInReport: boolean;
  preferenceCategory: { id: string; slug: string; name: string } | null;
  subTopics: SubTopic[];
};

export type UserPreferences = Record<string, { id: string; label: string; value: string }[]>;

// ─── Visible Content ──────────────────────────────────────────────────

export type VisibleContent = {
  mode: 'FILTER' | 'REPEAT' | 'CONTEXT';
  subTopics: SubTopic[];
  dimensions: Dimension[];
  questions: Question[];
  contextLabels: string[];
  repeatInstances: { id: string; label: string }[];
};

/**
 * Given a topic and user's preference selections, compute what content should be visible.
 *
 * - FILTER: Only show SubTopics whose preferenceOptionId matches user's selected preferences.
 *           Also populates contextLabels with selected preference labels.
 * - REPEAT: Use the first SubTopic as template, create repeat instances from preferences.
 * - CONTEXT: Show all SubTopics, populate contextLabels with selected preference labels.
 */
export function getVisibleContent(topic: Topic, userPreferences: UserPreferences): VisibleContent {
  const catSlug = topic.preferenceCategory?.slug;
  const selectedPrefs = catSlug ? (userPreferences[catSlug] ?? []) : [];

  switch (topic.preferenceMode) {
    case 'FILTER': {
      const selectedIds = new Set(selectedPrefs.map(p => p.id));
      const visibleSubTopics = topic.subTopics.filter(
        st => st.preferenceOptionId && selectedIds.has(st.preferenceOptionId)
      );
      return {
        mode: 'FILTER',
        subTopics: visibleSubTopics,
        dimensions: visibleSubTopics.flatMap(st => st.dimensions),
        questions: visibleSubTopics.flatMap(st => st.dimensions.flatMap(d => d.questions)),
        contextLabels: selectedPrefs.map(p => p.label),
        repeatInstances: [],
      };
    }
    case 'REPEAT': {
      const templateSubTopic = topic.subTopics[0];
      return {
        mode: 'REPEAT',
        subTopics: templateSubTopic ? [templateSubTopic] : [],
        dimensions: templateSubTopic?.dimensions ?? [],
        questions: templateSubTopic?.dimensions.flatMap(d => d.questions) ?? [],
        contextLabels: [],
        repeatInstances: selectedPrefs.map(p => ({ id: p.id, label: p.label })),
      };
    }
    case 'CONTEXT':
    default: {
      return {
        mode: 'CONTEXT',
        subTopics: topic.subTopics,
        dimensions: topic.subTopics.flatMap(st => st.dimensions),
        questions: topic.subTopics.flatMap(st => st.dimensions.flatMap(d => d.questions)),
        contextLabels: selectedPrefs.map(p => p.label),
        repeatInstances: [],
      };
    }
  }
}

// ─── Answer Key Helpers ───────────────────────────────────────────────

/**
 * Build the answer key for a question.
 * REPEAT mode: `questionId::prefOptionId`
 * Other modes: `questionId`
 */
export function getAnswerKey(questionId: string, mode: string, prefOptionId?: string): string {
  if (mode === 'REPEAT' && prefOptionId) {
    return `${questionId}::${prefOptionId}`;
  }
  return questionId;
}

/** Count the expected number of answers for a topic */
export function getExpectedAnswerCount(content: VisibleContent): number {
  if (content.mode === 'REPEAT') {
    return content.questions.length * content.repeatInstances.length;
  }
  return content.questions.length;
}

/** Count answered questions for a topic */
export function getAnsweredCount(content: VisibleContent, answers: Record<string, string>): number {
  if (content.mode === 'REPEAT') {
    let count = 0;
    for (const inst of content.repeatInstances) {
      for (const q of content.questions) {
        const key = getAnswerKey(q.id, 'REPEAT', inst.id);
        if (answers[key]) count++;
      }
    }
    return count;
  }
  return content.questions.filter(q => answers[q.id]).length;
}

/** Get unanswered questions for a topic */
export function getUnansweredQuestions(
  content: VisibleContent,
  answers: Record<string, string>,
): { question: Question; answerKey: string; instanceLabel?: string }[] {
  const unanswered: { question: Question; answerKey: string; instanceLabel?: string }[] = [];
  if (content.mode === 'REPEAT') {
    for (const inst of content.repeatInstances) {
      for (const q of content.questions) {
        const key = getAnswerKey(q.id, 'REPEAT', inst.id);
        if (!answers[key]) {
          unanswered.push({ question: q, answerKey: key, instanceLabel: inst.label });
        }
      }
    }
  } else {
    for (const q of content.questions) {
      if (!answers[q.id]) {
        unanswered.push({ question: q, answerKey: q.id });
      }
    }
  }
  return unanswered;
}

/**
 * Determine whether SubTopic section headers should be displayed.
 * - FILTER mode: always show (user needs to see which SubTopics matched their selections)
 * - Other modes: only when there are multiple SubTopics
 */
export function shouldShowSubTopicSections(content: VisibleContent): boolean {
  return content.mode === 'FILTER' || content.subTopics.length > 1;
}

/**
 * Build DimensionNav items. When SubTopic sections are shown,
 * prefix dimension names with SubTopic name for disambiguation.
 */
export function buildNavDimensions(content: VisibleContent): { id: string; name: string }[] {
  if (shouldShowSubTopicSections(content)) {
    return content.subTopics.flatMap(st =>
      st.dimensions.map(d => ({ id: d.id, name: `${st.name} / ${d.name}` }))
    );
  }
  return content.dimensions.map(d => ({ id: d.id, name: d.name }));
}

// ─── SubTopic Group Navigation Helpers ────────────────────────────────

export type SubTopicGroup = {
  id: string;
  name: string;
  dimensions: { id: string; name: string }[];
  questionIds: string[];
};

/**
 * Whether to display SubTopic vertical tabs (multi-group mode).
 * - FILTER mode: only when more than 1 SubTopic is visible
 * - CONTEXT: only when more than 1 SubTopic
 * - REPEAT: never (uses its own tab system)
 */
export function shouldShowSubTopicTabs(content: VisibleContent): boolean {
  if (content.mode === 'REPEAT') return false;
  return content.subTopics.length > 1;
}

/**
 * Build SubTopic groups for the vertical tab navigation.
 * Each group contains its dimensions (for display inside the tab)
 * and all question IDs (for progress calculation).
 */
export function buildSubTopicGroups(content: VisibleContent): SubTopicGroup[] {
  return content.subTopics.map(st => ({
    id: st.id,
    name: st.name,
    dimensions: st.dimensions.map(d => ({ id: d.id, name: d.name })),
    questionIds: st.dimensions.flatMap(d => d.questions.map(q => q.id)),
  }));
}

/**
 * Count answered questions within a specific SubTopic group.
 */
export function getGroupAnsweredCount(
  group: SubTopicGroup,
  answers: Record<string, string>,
): number {
  return group.questionIds.filter(qId => answers[qId]).length;
}

/**
 * Format percentage to 1 decimal place (e.g., "76.5%").
 * Returns "0.0%" for 0/0.
 */
export function formatPercent(answered: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((answered / total) * 100).toFixed(1)}%`;
}

/**
 * Find the first unanswered question ID in a SubTopic group.
 */
export function findFirstUnansweredInGroup(
  group: SubTopicGroup,
  answers: Record<string, string>,
): string | null {
  return group.questionIds.find(qId => !answers[qId]) ?? null;
}

/**
 * Find the first unanswered question ID in the entire visible content.
 */
export function findFirstUnanswered(
  content: VisibleContent,
  answers: Record<string, string>,
): string | null {
  for (const q of content.questions) {
    if (!answers[q.id]) return q.id;
  }
  return null;
}
