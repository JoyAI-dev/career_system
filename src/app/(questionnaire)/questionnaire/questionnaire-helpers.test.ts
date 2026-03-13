import { describe, it, expect } from 'vitest';
import {
  type Topic,
  type SubTopic,
  type Dimension,
  type Question,
  type UserPreferences,
  getVisibleContent,
  getAnswerKey,
  getExpectedAnswerCount,
  getAnsweredCount,
  getUnansweredQuestions,
  shouldShowSubTopicSections,
  shouldShowSubTopicTabs,
  buildNavDimensions,
  buildSubTopicGroups,
  getGroupAnsweredCount,
  formatPercent,
  findFirstUnansweredInGroup,
  findFirstUnanswered,
} from './questionnaire-helpers';

// ─── Test Data Factories ──────────────────────────────────────────────

function makeQuestion(id: string, title = `Question ${id}`): Question {
  return {
    id,
    title,
    order: 1,
    notes: [],
    answerOptions: [
      { id: `${id}-opt-a`, label: 'Option A', score: 1, order: 1 },
      { id: `${id}-opt-b`, label: 'Option B', score: 2, order: 2 },
      { id: `${id}-opt-c`, label: 'Option C', score: 3, order: 3 },
    ],
  };
}

function makeDimension(id: string, name: string, questionIds: string[]): Dimension {
  return {
    id,
    name,
    order: 1,
    questions: questionIds.map(qId => makeQuestion(qId)),
  };
}

function makeSubTopic(
  id: string,
  name: string,
  dimensions: Dimension[],
  preferenceOptionId: string | null = null,
): SubTopic {
  return { id, name, order: 1, preferenceOptionId, dimensions };
}

function makeTopic(
  id: string,
  name: string,
  opts: {
    preferenceMode: string;
    subTopics: SubTopic[];
    categorySlug?: string;
  },
): Topic {
  return {
    id,
    name,
    order: 1,
    preferenceMode: opts.preferenceMode,
    showInReport: true,
    preferenceCategory: opts.categorySlug
      ? { id: `cat-${opts.categorySlug}`, slug: opts.categorySlug, name: `Category ${opts.categorySlug}` }
      : null,
    subTopics: opts.subTopics,
  };
}

// ─── FILTER mode fixtures ─────────────────────────────────────────────

/**
 * Simulates Topic 2 "自我定位" (FILTER mode):
 * Category: "self_position"
 * SubTopics: 商人 (pref-businessman), 创业者 (pref-entrepreneur), 学者 (pref-scholar)
 * Each SubTopic has 2 dimensions × 2 questions = 4 questions per SubTopic
 */
function makeFilterTopic(): Topic {
  return makeTopic('topic-2', '自我定位（多选）', {
    preferenceMode: 'FILTER',
    categorySlug: 'self_position',
    subTopics: [
      makeSubTopic('st-businessman', '商人', [
        makeDimension('dim-biz-what', '是什么', ['q1', 'q2']),
        makeDimension('dim-biz-impact', '意味着什么', ['q3', 'q4']),
      ], 'pref-businessman'),
      makeSubTopic('st-entrepreneur', '创业者', [
        makeDimension('dim-ent-what', '是什么', ['q5', 'q6']),
        makeDimension('dim-ent-impact', '意味着什么', ['q7', 'q8']),
      ], 'pref-entrepreneur'),
      makeSubTopic('st-scholar', '学者', [
        makeDimension('dim-sch-what', '是什么', ['q9', 'q10']),
        makeDimension('dim-sch-impact', '意味着什么', ['q11', 'q12']),
      ], 'pref-scholar'),
    ],
  });
}

/**
 * Simulates Topic 10 "培训" (CONTEXT mode):
 * Category: "training_method"
 * SubTopics: 管理培训, 轮岗, 自我学习 (all shown, no filtering)
 * Each has 1 dimension × 2 questions
 */
function makeContextTopic(): Topic {
  return makeTopic('topic-10', '培训', {
    preferenceMode: 'CONTEXT',
    categorySlug: 'training_method',
    subTopics: [
      makeSubTopic('st-mgmt', '管理培训', [
        makeDimension('dim-mgmt-1', '方式', ['q20', 'q21']),
      ]),
      makeSubTopic('st-rotation', '轮岗', [
        makeDimension('dim-rot-1', '方式', ['q22', 'q23']),
      ]),
      makeSubTopic('st-self', '自我学习', [
        makeDimension('dim-self-1', '方式', ['q24', 'q25']),
      ]),
    ],
  });
}

/**
 * Simulates a CONTEXT topic with only 1 SubTopic (common case)
 */
function makeSingleSubTopicContextTopic(): Topic {
  return makeTopic('topic-simple', '简单话题', {
    preferenceMode: 'CONTEXT',
    categorySlug: 'some_cat',
    subTopics: [
      makeSubTopic('st-only', '唯一子话题', [
        makeDimension('dim-a', '维度A', ['q30', 'q31']),
        makeDimension('dim-b', '维度B', ['q32', 'q33']),
      ]),
    ],
  });
}

/** REPEAT mode topic */
function makeRepeatTopic(): Topic {
  return makeTopic('topic-repeat', '重复模式话题', {
    preferenceMode: 'REPEAT',
    categorySlug: 'city',
    subTopics: [
      makeSubTopic('st-template', '模板', [
        makeDimension('dim-tpl-1', '维度1', ['q40', 'q41']),
        makeDimension('dim-tpl-2', '维度2', ['q42']),
      ]),
    ],
  });
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('getVisibleContent', () => {
  // ── FILTER mode ──

  describe('FILTER mode', () => {
    const filterTopic = makeFilterTopic();

    it('should filter SubTopics by single selected preference', () => {
      const prefs: UserPreferences = {
        self_position: [{ id: 'pref-businessman', label: '商人', value: 'businessman' }],
      };
      const result = getVisibleContent(filterTopic, prefs);

      expect(result.mode).toBe('FILTER');
      expect(result.subTopics).toHaveLength(1);
      expect(result.subTopics[0].name).toBe('商人');
      expect(result.dimensions).toHaveLength(2);
      expect(result.questions).toHaveLength(4);
    });

    it('should filter SubTopics by multiple selected preferences', () => {
      const prefs: UserPreferences = {
        self_position: [
          { id: 'pref-businessman', label: '商人', value: 'businessman' },
          { id: 'pref-scholar', label: '学者', value: 'scholar' },
        ],
      };
      const result = getVisibleContent(filterTopic, prefs);

      expect(result.mode).toBe('FILTER');
      expect(result.subTopics).toHaveLength(2);
      expect(result.subTopics.map(st => st.name)).toEqual(['商人', '学者']);
      expect(result.dimensions).toHaveLength(4);
      expect(result.questions).toHaveLength(8);
    });

    it('should include all selected preferences in contextLabels', () => {
      const prefs: UserPreferences = {
        self_position: [
          { id: 'pref-businessman', label: '商人', value: 'businessman' },
          { id: 'pref-scholar', label: '学者', value: 'scholar' },
        ],
      };
      const result = getVisibleContent(filterTopic, prefs);

      expect(result.contextLabels).toEqual(['商人', '学者']);
    });

    it('should include contextLabels even for single selection', () => {
      const prefs: UserPreferences = {
        self_position: [{ id: 'pref-entrepreneur', label: '创业者', value: 'entrepreneur' }],
      };
      const result = getVisibleContent(filterTopic, prefs);

      expect(result.contextLabels).toEqual(['创业者']);
    });

    it('should return empty when no preferences match', () => {
      const prefs: UserPreferences = {
        self_position: [{ id: 'pref-nonexistent', label: '不存在', value: 'none' }],
      };
      const result = getVisibleContent(filterTopic, prefs);

      expect(result.subTopics).toHaveLength(0);
      expect(result.questions).toHaveLength(0);
      expect(result.contextLabels).toEqual(['不存在']);
    });

    it('should return empty when preference category does not exist in user prefs', () => {
      const prefs: UserPreferences = {};
      const result = getVisibleContent(filterTopic, prefs);

      expect(result.subTopics).toHaveLength(0);
      expect(result.questions).toHaveLength(0);
      expect(result.contextLabels).toEqual([]);
    });

    it('should have empty repeatInstances in FILTER mode', () => {
      const prefs: UserPreferences = {
        self_position: [{ id: 'pref-businessman', label: '商人', value: 'businessman' }],
      };
      const result = getVisibleContent(filterTopic, prefs);
      expect(result.repeatInstances).toEqual([]);
    });
  });

  // ── CONTEXT mode ──

  describe('CONTEXT mode', () => {
    const contextTopic = makeContextTopic();

    it('should include all SubTopics regardless of preferences', () => {
      const prefs: UserPreferences = {
        training_method: [{ id: 'tm-rotation', label: '轮岗', value: 'rotation' }],
      };
      const result = getVisibleContent(contextTopic, prefs);

      expect(result.mode).toBe('CONTEXT');
      expect(result.subTopics).toHaveLength(3);
      expect(result.subTopics.map(st => st.name)).toEqual(['管理培训', '轮岗', '自我学习']);
    });

    it('should include all questions from all SubTopics', () => {
      const prefs: UserPreferences = {};
      const result = getVisibleContent(contextTopic, prefs);

      expect(result.dimensions).toHaveLength(3);
      expect(result.questions).toHaveLength(6);
    });

    it('should populate contextLabels with selected preferences', () => {
      const prefs: UserPreferences = {
        training_method: [
          { id: 'tm-mgmt', label: '管理培训', value: 'management' },
          { id: 'tm-rotation', label: '轮岗', value: 'rotation' },
        ],
      };
      const result = getVisibleContent(contextTopic, prefs);

      expect(result.contextLabels).toEqual(['管理培训', '轮岗']);
    });

    it('should have empty contextLabels when no preferences exist', () => {
      const prefs: UserPreferences = {};
      const result = getVisibleContent(contextTopic, prefs);
      expect(result.contextLabels).toEqual([]);
    });

    it('should work with single SubTopic CONTEXT topic', () => {
      const singleTopic = makeSingleSubTopicContextTopic();
      const prefs: UserPreferences = {};
      const result = getVisibleContent(singleTopic, prefs);

      expect(result.subTopics).toHaveLength(1);
      expect(result.dimensions).toHaveLength(2);
      expect(result.questions).toHaveLength(4);
    });
  });

  // ── REPEAT mode ──

  describe('REPEAT mode', () => {
    const repeatTopic = makeRepeatTopic();

    it('should use first SubTopic as template', () => {
      const prefs: UserPreferences = {
        city: [
          { id: 'city-beijing', label: '北京', value: 'beijing' },
          { id: 'city-shanghai', label: '上海', value: 'shanghai' },
        ],
      };
      const result = getVisibleContent(repeatTopic, prefs);

      expect(result.mode).toBe('REPEAT');
      expect(result.subTopics).toHaveLength(1);
      expect(result.dimensions).toHaveLength(2);
      expect(result.questions).toHaveLength(3);
    });

    it('should create repeat instances from preferences', () => {
      const prefs: UserPreferences = {
        city: [
          { id: 'city-beijing', label: '北京', value: 'beijing' },
          { id: 'city-shanghai', label: '上海', value: 'shanghai' },
          { id: 'city-guangzhou', label: '广州', value: 'guangzhou' },
        ],
      };
      const result = getVisibleContent(repeatTopic, prefs);

      expect(result.repeatInstances).toHaveLength(3);
      expect(result.repeatInstances.map(r => r.label)).toEqual(['北京', '上海', '广州']);
    });

    it('should have empty contextLabels in REPEAT mode', () => {
      const prefs: UserPreferences = {
        city: [{ id: 'city-beijing', label: '北京', value: 'beijing' }],
      };
      const result = getVisibleContent(repeatTopic, prefs);
      expect(result.contextLabels).toEqual([]);
    });

    it('should handle no preferences gracefully', () => {
      const prefs: UserPreferences = {};
      const result = getVisibleContent(repeatTopic, prefs);
      expect(result.repeatInstances).toEqual([]);
    });
  });

  // ── Topic without preferenceCategory ──

  describe('topic without preferenceCategory', () => {
    it('should default to CONTEXT mode with all SubTopics', () => {
      const topic = makeTopic('topic-no-cat', '无偏好分类', {
        preferenceMode: 'CONTEXT',
        subTopics: [
          makeSubTopic('st-1', 'Sub1', [makeDimension('d1', 'Dim1', ['q50'])]),
          makeSubTopic('st-2', 'Sub2', [makeDimension('d2', 'Dim2', ['q51'])]),
        ],
      });
      const prefs: UserPreferences = { some_other: [{ id: 'x', label: 'X', value: 'x' }] };
      const result = getVisibleContent(topic, prefs);

      expect(result.mode).toBe('CONTEXT');
      expect(result.subTopics).toHaveLength(2);
      expect(result.contextLabels).toEqual([]);
    });
  });
});

// ─── getAnswerKey ─────────────────────────────────────────────────────

describe('getAnswerKey', () => {
  it('returns questionId for FILTER mode', () => {
    expect(getAnswerKey('q1', 'FILTER')).toBe('q1');
  });

  it('returns questionId for CONTEXT mode', () => {
    expect(getAnswerKey('q1', 'CONTEXT')).toBe('q1');
  });

  it('returns composite key for REPEAT mode with prefOptionId', () => {
    expect(getAnswerKey('q1', 'REPEAT', 'pref-a')).toBe('q1::pref-a');
  });

  it('returns questionId for REPEAT mode without prefOptionId', () => {
    expect(getAnswerKey('q1', 'REPEAT')).toBe('q1');
  });
});

// ─── getExpectedAnswerCount ───────────────────────────────────────────

describe('getExpectedAnswerCount', () => {
  it('counts questions for FILTER mode', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [
        { id: 'pref-businessman', label: '商人', value: 'businessman' },
        { id: 'pref-scholar', label: '学者', value: 'scholar' },
      ],
    };
    const content = getVisibleContent(filterTopic, prefs);
    expect(getExpectedAnswerCount(content)).toBe(8); // 2 SubTopics × 2 dims × 2 questions
  });

  it('counts questions × instances for REPEAT mode', () => {
    const repeatTopic = makeRepeatTopic();
    const prefs: UserPreferences = {
      city: [
        { id: 'city-beijing', label: '北京', value: 'beijing' },
        { id: 'city-shanghai', label: '上海', value: 'shanghai' },
      ],
    };
    const content = getVisibleContent(repeatTopic, prefs);
    expect(getExpectedAnswerCount(content)).toBe(6); // 3 questions × 2 instances
  });

  it('counts questions for CONTEXT mode', () => {
    const contextTopic = makeContextTopic();
    const content = getVisibleContent(contextTopic, {});
    expect(getExpectedAnswerCount(content)).toBe(6); // 3 SubTopics × 1 dim × 2 questions
  });
});

// ─── getAnsweredCount ─────────────────────────────────────────────────

describe('getAnsweredCount', () => {
  it('counts answered questions in FILTER mode', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [{ id: 'pref-businessman', label: '商人', value: 'businessman' }],
    };
    const content = getVisibleContent(filterTopic, prefs);
    const answers = { q1: 'opt-a', q3: 'opt-b' }; // 2 of 4 answered
    expect(getAnsweredCount(content, answers)).toBe(2);
  });

  it('counts answered questions in REPEAT mode with composite keys', () => {
    const repeatTopic = makeRepeatTopic();
    const prefs: UserPreferences = {
      city: [
        { id: 'city-beijing', label: '北京', value: 'beijing' },
        { id: 'city-shanghai', label: '上海', value: 'shanghai' },
      ],
    };
    const content = getVisibleContent(repeatTopic, prefs);
    const answers = {
      'q40::city-beijing': 'opt-a',
      'q41::city-beijing': 'opt-b',
      'q40::city-shanghai': 'opt-c',
    }; // 3 of 6 answered
    expect(getAnsweredCount(content, answers)).toBe(3);
  });

  it('returns 0 when nothing answered', () => {
    const contextTopic = makeContextTopic();
    const content = getVisibleContent(contextTopic, {});
    expect(getAnsweredCount(content, {})).toBe(0);
  });
});

// ─── getUnansweredQuestions ───────────────────────────────────────────

describe('getUnansweredQuestions', () => {
  it('returns all questions when none answered in FILTER mode', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [{ id: 'pref-businessman', label: '商人', value: 'businessman' }],
    };
    const content = getVisibleContent(filterTopic, prefs);
    const unanswered = getUnansweredQuestions(content, {});

    expect(unanswered).toHaveLength(4); // 2 dims × 2 questions
    expect(unanswered.every(u => u.instanceLabel === undefined)).toBe(true);
  });

  it('returns empty when all answered in FILTER mode', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [{ id: 'pref-businessman', label: '商人', value: 'businessman' }],
    };
    const content = getVisibleContent(filterTopic, prefs);
    const answers = { q1: 'a', q2: 'b', q3: 'c', q4: 'd' };
    const unanswered = getUnansweredQuestions(content, answers);

    expect(unanswered).toHaveLength(0);
  });

  it('includes instanceLabel for REPEAT mode unanswered', () => {
    const repeatTopic = makeRepeatTopic();
    const prefs: UserPreferences = {
      city: [
        { id: 'city-beijing', label: '北京', value: 'beijing' },
        { id: 'city-shanghai', label: '上海', value: 'shanghai' },
      ],
    };
    const content = getVisibleContent(repeatTopic, prefs);
    const answers = {
      'q40::city-beijing': 'a',
      'q41::city-beijing': 'b',
      'q42::city-beijing': 'c',
    };
    const unanswered = getUnansweredQuestions(content, answers);

    // Only Shanghai's 3 questions should be unanswered
    expect(unanswered).toHaveLength(3);
    expect(unanswered.every(u => u.instanceLabel === '上海')).toBe(true);
  });
});

// ─── shouldShowSubTopicSections ───────────────────────────────────────

describe('shouldShowSubTopicSections', () => {
  it('returns true for FILTER mode even with single visible SubTopic', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [{ id: 'pref-businessman', label: '商人', value: 'businessman' }],
    };
    const content = getVisibleContent(filterTopic, prefs);
    expect(content.subTopics).toHaveLength(1); // only 1 visible
    expect(shouldShowSubTopicSections(content)).toBe(true);
  });

  it('returns true for FILTER mode with multiple visible SubTopics', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [
        { id: 'pref-businessman', label: '商人', value: 'businessman' },
        { id: 'pref-scholar', label: '学者', value: 'scholar' },
      ],
    };
    const content = getVisibleContent(filterTopic, prefs);
    expect(shouldShowSubTopicSections(content)).toBe(true);
  });

  it('returns true for CONTEXT mode with multiple SubTopics', () => {
    const contextTopic = makeContextTopic();
    const content = getVisibleContent(contextTopic, {});
    expect(content.subTopics).toHaveLength(3);
    expect(shouldShowSubTopicSections(content)).toBe(true);
  });

  it('returns false for CONTEXT mode with single SubTopic', () => {
    const singleTopic = makeSingleSubTopicContextTopic();
    const content = getVisibleContent(singleTopic, {});
    expect(content.subTopics).toHaveLength(1);
    expect(shouldShowSubTopicSections(content)).toBe(false);
  });

  it('returns false for REPEAT mode with single template SubTopic', () => {
    const repeatTopic = makeRepeatTopic();
    const prefs: UserPreferences = {
      city: [{ id: 'city-beijing', label: '北京', value: 'beijing' }],
    };
    const content = getVisibleContent(repeatTopic, prefs);
    expect(shouldShowSubTopicSections(content)).toBe(false);
  });
});

// ─── buildNavDimensions ───────────────────────────────────────────────

describe('buildNavDimensions', () => {
  it('prefixes dimension names with SubTopic name in FILTER mode (single selection)', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [{ id: 'pref-businessman', label: '商人', value: 'businessman' }],
    };
    const content = getVisibleContent(filterTopic, prefs);
    const navDims = buildNavDimensions(content);

    expect(navDims).toEqual([
      { id: 'dim-biz-what', name: '商人 / 是什么' },
      { id: 'dim-biz-impact', name: '商人 / 意味着什么' },
    ]);
  });

  it('prefixes dimension names with SubTopic name in FILTER mode (multi-selection)', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [
        { id: 'pref-businessman', label: '商人', value: 'businessman' },
        { id: 'pref-entrepreneur', label: '创业者', value: 'entrepreneur' },
      ],
    };
    const content = getVisibleContent(filterTopic, prefs);
    const navDims = buildNavDimensions(content);

    expect(navDims).toEqual([
      { id: 'dim-biz-what', name: '商人 / 是什么' },
      { id: 'dim-biz-impact', name: '商人 / 意味着什么' },
      { id: 'dim-ent-what', name: '创业者 / 是什么' },
      { id: 'dim-ent-impact', name: '创业者 / 意味着什么' },
    ]);
  });

  it('prefixes dimension names in CONTEXT mode with multiple SubTopics', () => {
    const contextTopic = makeContextTopic();
    const content = getVisibleContent(contextTopic, {});
    const navDims = buildNavDimensions(content);

    expect(navDims).toEqual([
      { id: 'dim-mgmt-1', name: '管理培训 / 方式' },
      { id: 'dim-rot-1', name: '轮岗 / 方式' },
      { id: 'dim-self-1', name: '自我学习 / 方式' },
    ]);
  });

  it('does not prefix in CONTEXT mode with single SubTopic', () => {
    const singleTopic = makeSingleSubTopicContextTopic();
    const content = getVisibleContent(singleTopic, {});
    const navDims = buildNavDimensions(content);

    expect(navDims).toEqual([
      { id: 'dim-a', name: '维度A' },
      { id: 'dim-b', name: '维度B' },
    ]);
  });

  it('does not prefix in REPEAT mode (single template SubTopic)', () => {
    const repeatTopic = makeRepeatTopic();
    const prefs: UserPreferences = {
      city: [{ id: 'city-beijing', label: '北京', value: 'beijing' }],
    };
    const content = getVisibleContent(repeatTopic, prefs);
    const navDims = buildNavDimensions(content);

    expect(navDims).toEqual([
      { id: 'dim-tpl-1', name: '维度1' },
      { id: 'dim-tpl-2', name: '维度2' },
    ]);
  });
});

// ─── shouldShowSubTopicTabs ───────────────────────────────────────────

describe('shouldShowSubTopicTabs', () => {
  it('returns true for FILTER mode with 2+ visible SubTopics', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [
        { id: 'pref-businessman', label: '商人', value: 'businessman' },
        { id: 'pref-scholar', label: '学者', value: 'scholar' },
      ],
    };
    const content = getVisibleContent(filterTopic, prefs);
    expect(shouldShowSubTopicTabs(content)).toBe(true);
  });

  it('returns false for FILTER mode with only 1 visible SubTopic', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [{ id: 'pref-businessman', label: '商人', value: 'businessman' }],
    };
    const content = getVisibleContent(filterTopic, prefs);
    expect(shouldShowSubTopicTabs(content)).toBe(false);
  });

  it('returns true for CONTEXT mode with multiple SubTopics', () => {
    const contextTopic = makeContextTopic();
    const content = getVisibleContent(contextTopic, {});
    expect(shouldShowSubTopicTabs(content)).toBe(true);
  });

  it('returns false for CONTEXT mode with single SubTopic', () => {
    const singleTopic = makeSingleSubTopicContextTopic();
    const content = getVisibleContent(singleTopic, {});
    expect(shouldShowSubTopicTabs(content)).toBe(false);
  });

  it('returns false for REPEAT mode (always uses its own tab system)', () => {
    const repeatTopic = makeRepeatTopic();
    const prefs: UserPreferences = {
      city: [
        { id: 'city-beijing', label: '北京', value: 'beijing' },
        { id: 'city-shanghai', label: '上海', value: 'shanghai' },
      ],
    };
    const content = getVisibleContent(repeatTopic, prefs);
    expect(shouldShowSubTopicTabs(content)).toBe(false);
  });
});

// ─── buildSubTopicGroups ──────────────────────────────────────────────

describe('buildSubTopicGroups', () => {
  it('builds groups for CONTEXT mode with multiple SubTopics', () => {
    const contextTopic = makeContextTopic();
    const content = getVisibleContent(contextTopic, {});
    const groups = buildSubTopicGroups(content);

    expect(groups).toHaveLength(3);
    expect(groups[0].name).toBe('管理培训');
    expect(groups[0].dimensions).toEqual([{ id: 'dim-mgmt-1', name: '方式' }]);
    expect(groups[0].questionIds).toEqual(['q20', 'q21']);
    expect(groups[1].name).toBe('轮岗');
    expect(groups[2].name).toBe('自我学习');
  });

  it('builds groups for FILTER mode with multi-selection', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [
        { id: 'pref-businessman', label: '商人', value: 'businessman' },
        { id: 'pref-entrepreneur', label: '创业者', value: 'entrepreneur' },
      ],
    };
    const content = getVisibleContent(filterTopic, prefs);
    const groups = buildSubTopicGroups(content);

    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe('商人');
    expect(groups[0].dimensions).toHaveLength(2);
    expect(groups[0].questionIds).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(groups[1].name).toBe('创业者');
  });
});

// ─── getGroupAnsweredCount ────────────────────────────────────────────

describe('getGroupAnsweredCount', () => {
  it('counts answered questions within a group', () => {
    const contextTopic = makeContextTopic();
    const content = getVisibleContent(contextTopic, {});
    const groups = buildSubTopicGroups(content);

    const answers = { q20: 'a', q22: 'b', q23: 'c' };
    expect(getGroupAnsweredCount(groups[0], answers)).toBe(1); // only q20
    expect(getGroupAnsweredCount(groups[1], answers)).toBe(2); // q22, q23
    expect(getGroupAnsweredCount(groups[2], answers)).toBe(0); // none
  });
});

// ─── formatPercent ────────────────────────────────────────────────────

describe('formatPercent', () => {
  it('formats 0/0 as 0.0%', () => {
    expect(formatPercent(0, 0)).toBe('0.0%');
  });

  it('formats 0/10 as 0.0%', () => {
    expect(formatPercent(0, 10)).toBe('0.0%');
  });

  it('formats 5/10 as 50.0%', () => {
    expect(formatPercent(5, 10)).toBe('50.0%');
  });

  it('formats 1/3 as 33.3%', () => {
    expect(formatPercent(1, 3)).toBe('33.3%');
  });

  it('formats 10/10 as 100.0%', () => {
    expect(formatPercent(10, 10)).toBe('100.0%');
  });
});

// ─── findFirstUnansweredInGroup ───────────────────────────────────────

describe('findFirstUnansweredInGroup', () => {
  it('finds the first unanswered question in a group', () => {
    const contextTopic = makeContextTopic();
    const content = getVisibleContent(contextTopic, {});
    const groups = buildSubTopicGroups(content);

    const answers = { q20: 'a' }; // q21 is unanswered
    expect(findFirstUnansweredInGroup(groups[0], answers)).toBe('q21');
  });

  it('returns null if all answered', () => {
    const contextTopic = makeContextTopic();
    const content = getVisibleContent(contextTopic, {});
    const groups = buildSubTopicGroups(content);

    const answers = { q20: 'a', q21: 'b' };
    expect(findFirstUnansweredInGroup(groups[0], answers)).toBeNull();
  });
});

// ─── findFirstUnanswered ──────────────────────────────────────────────

describe('findFirstUnanswered', () => {
  it('finds the first unanswered question in visible content', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [{ id: 'pref-businessman', label: '商人', value: 'businessman' }],
    };
    const content = getVisibleContent(filterTopic, prefs);

    const answers = { q1: 'a' }; // q2 is first unanswered
    expect(findFirstUnanswered(content, answers)).toBe('q2');
  });

  it('returns null when all answered', () => {
    const filterTopic = makeFilterTopic();
    const prefs: UserPreferences = {
      self_position: [{ id: 'pref-businessman', label: '商人', value: 'businessman' }],
    };
    const content = getVisibleContent(filterTopic, prefs);

    const answers = { q1: 'a', q2: 'b', q3: 'c', q4: 'd' };
    expect(findFirstUnanswered(content, answers)).toBeNull();
  });

  it('returns first question when nothing answered', () => {
    const contextTopic = makeContextTopic();
    const content = getVisibleContent(contextTopic, {});
    expect(findFirstUnanswered(content, {})).toBe('q20');
  });
});
