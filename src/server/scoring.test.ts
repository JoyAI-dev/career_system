import { describe, it, expect } from 'vitest';
import { calculateScores, calculateScoresFromMap } from './scoring';

// ─── Helpers ─────────────────────────────────────────────────────────

/** Build a CONTEXT-mode structure (most common: single SubTopic, no preference filtering) */
function makeStructure(
  topics: {
    id: string;
    name: string;
    showInReport?: boolean;
    preferenceMode?: string;
    questions: { id: string; title: string }[];
  }[],
) {
  return {
    topics: topics.map((t) => ({
      id: t.id,
      name: t.name,
      preferenceMode: t.preferenceMode ?? 'CONTEXT',
      showInReport: t.showInReport ?? true,
      subTopics: [
        {
          id: `${t.id}-st-1`,
          name: 'Default SubTopic',
          preferenceOptionId: null,
          dimensions: [
            {
              questions: t.questions,
            },
          ],
        },
      ],
    })),
  };
}

/** Build a structure with explicit SubTopics (for FILTER/multi-SubTopic tests) */
function makeMultiSubTopicStructure(
  topics: {
    id: string;
    name: string;
    showInReport?: boolean;
    preferenceMode?: string;
    subTopics: {
      id: string;
      name: string;
      preferenceOptionId?: string | null;
      dimensions: {
        questions: { id: string; title: string }[];
      }[];
    }[];
  }[],
) {
  return {
    topics: topics.map((t) => ({
      id: t.id,
      name: t.name,
      preferenceMode: t.preferenceMode ?? 'CONTEXT',
      showInReport: t.showInReport ?? true,
      subTopics: t.subTopics.map((st) => ({
        id: st.id,
        name: st.name,
        preferenceOptionId: st.preferenceOptionId ?? null,
        dimensions: st.dimensions,
      })),
    })),
  };
}

function makeAnswers(
  entries: { questionId: string; score: number; preferenceOptionId?: string | null }[],
) {
  return entries.map((e) => ({
    questionId: e.questionId,
    selectedOption: { score: e.score },
    preferenceOptionId: e.preferenceOptionId ?? null,
  }));
}

// ─── Basic Scoring Tests (CONTEXT mode) ──────────────────────────────

describe('calculateScores', () => {
  it('calculates topic score as average of question scores', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Topic A',
        questions: [
          { id: 'q1', title: 'Question 1' },
          { id: 'q2', title: 'Question 2' },
          { id: 'q3', title: 'Question 3' },
        ],
      },
    ]);

    const answers = makeAnswers([
      { questionId: 'q1', score: 60 },
      { questionId: 'q2', score: 80 },
      { questionId: 'q3', score: 40 },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    expect(result.topicScores).toHaveLength(1);
    expect(result.topicScores[0].score).toBe(60);
    expect(result.overallScore).toBe(60);
  });

  it('calculates overall score as average of topic scores', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Topic A',
        questions: [
          { id: 'q1', title: 'Q1' },
          { id: 'q2', title: 'Q2' },
        ],
      },
      {
        id: 'topic-2',
        name: 'Topic B',
        questions: [
          { id: 'q3', title: 'Q3' },
          { id: 'q4', title: 'Q4' },
        ],
      },
    ]);

    const answers = makeAnswers([
      { questionId: 'q1', score: 80 },
      { questionId: 'q2', score: 60 },
      { questionId: 'q3', score: 40 },
      { questionId: 'q4', score: 20 },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    expect(result.topicScores[0].score).toBe(70); // (80+60)/2
    expect(result.topicScores[1].score).toBe(30); // (40+20)/2
    expect(result.overallScore).toBe(50); // (70+30)/2
  });

  it('returns per-question scores in SubTopicScore', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Topic A',
        questions: [
          { id: 'q1', title: 'Question 1' },
          { id: 'q2', title: 'Question 2' },
        ],
      },
    ]);

    const answers = makeAnswers([
      { questionId: 'q1', score: 75 },
      { questionId: 'q2', score: 25 },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    // Question scores are now on SubTopicScore, not TopicScore
    expect(result.topicScores[0].subTopicScores).toHaveLength(1);
    expect(result.topicScores[0].subTopicScores[0].questionScores).toEqual([
      { questionId: 'q1', questionTitle: 'Question 1', score: 75 },
      { questionId: 'q2', questionTitle: 'Question 2', score: 25 },
    ]);
  });

  it('handles empty answers gracefully (scores default to 0)', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Topic A',
        questions: [
          { id: 'q1', title: 'Q1' },
          { id: 'q2', title: 'Q2' },
        ],
      },
    ]);

    const result = calculateScores('snap-1', 'ver-1', [], structure);

    expect(result.topicScores[0].score).toBe(0);
    expect(result.topicScores[0].subTopicScores[0].questionScores[0].score).toBe(0);
    expect(result.topicScores[0].subTopicScores[0].questionScores[1].score).toBe(0);
    expect(result.overallScore).toBe(0);
  });

  it('handles empty topics gracefully', () => {
    const structure = makeStructure([]);

    const result = calculateScores('snap-1', 'ver-1', [], structure);

    expect(result.topicScores).toEqual([]);
    expect(result.overallScore).toBe(0);
  });

  it('handles topic with no questions gracefully', () => {
    const structure = makeStructure([
      { id: 'topic-1', name: 'Empty Topic', questions: [] },
    ]);

    const result = calculateScores('snap-1', 'ver-1', [], structure);

    expect(result.topicScores[0].score).toBe(0);
    expect(result.topicScores[0].subTopicScores[0].questionScores).toEqual([]);
    expect(result.overallScore).toBe(0);
  });

  it('ignores answers for questions not in the structure (version-aware)', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Topic A',
        questions: [{ id: 'q1', title: 'Q1' }],
      },
    ]);

    const answers = makeAnswers([
      { questionId: 'q1', score: 80 },
      { questionId: 'q2', score: 100 },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    expect(result.topicScores[0].score).toBe(80);
    expect(result.topicScores[0].subTopicScores[0].questionScores).toHaveLength(1);
    expect(result.overallScore).toBe(80);
  });

  it('handles multiple dimensions within a SubTopic', () => {
    const structure = makeMultiSubTopicStructure([
      {
        id: 'topic-1',
        name: 'Topic A',
        subTopics: [
          {
            id: 'st-1',
            name: 'SubTopic 1',
            dimensions: [
              {
                questions: [
                  { id: 'q1', title: 'Q1' },
                  { id: 'q2', title: 'Q2' },
                ],
              },
              {
                questions: [{ id: 'q3', title: 'Q3' }],
              },
            ],
          },
        ],
      },
    ]);

    const answers = makeAnswers([
      { questionId: 'q1', score: 60 },
      { questionId: 'q2', score: 90 },
      { questionId: 'q3', score: 30 },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    // All 3 questions averaged: (60+90+30)/3 = 60
    expect(result.topicScores[0].score).toBe(60);
    expect(result.topicScores[0].subTopicScores[0].questionScores).toHaveLength(3);
  });

  it('rounds scores to 2 decimal places', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Topic A',
        questions: [
          { id: 'q1', title: 'Q1' },
          { id: 'q2', title: 'Q2' },
          { id: 'q3', title: 'Q3' },
        ],
      },
    ]);

    const answers = makeAnswers([
      { questionId: 'q1', score: 33 },
      { questionId: 'q2', score: 33 },
      { questionId: 'q3', score: 34 },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    // (33+33+34)/3 = 33.333... → 33.33
    expect(result.topicScores[0].score).toBe(33.33);
    expect(result.overallScore).toBe(33.33);
  });

  it('preserves snapshotId and versionId in result', () => {
    const structure = makeStructure([]);

    const result = calculateScores('my-snap', 'my-ver', [], structure);

    expect(result.snapshotId).toBe('my-snap');
    expect(result.versionId).toBe('my-ver');
  });

  it('handles all questions scoring 100', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Topic A',
        questions: [
          { id: 'q1', title: 'Q1' },
          { id: 'q2', title: 'Q2' },
        ],
      },
    ]);

    const answers = makeAnswers([
      { questionId: 'q1', score: 100 },
      { questionId: 'q2', score: 100 },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    expect(result.topicScores[0].score).toBe(100);
    expect(result.overallScore).toBe(100);
  });

  it('handles all questions scoring 0', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Topic A',
        questions: [
          { id: 'q1', title: 'Q1' },
          { id: 'q2', title: 'Q2' },
        ],
      },
    ]);

    const answers = makeAnswers([
      { questionId: 'q1', score: 0 },
      { questionId: 'q2', score: 0 },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    expect(result.topicScores[0].score).toBe(0);
    expect(result.overallScore).toBe(0);
  });

  it('handles single question in single topic', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Solo Topic',
        questions: [{ id: 'q1', title: 'Only Question' }],
      },
    ]);

    const answers = makeAnswers([{ questionId: 'q1', score: 42 }]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    expect(result.topicScores[0].score).toBe(42);
    expect(result.overallScore).toBe(42);
  });

  it('handles missing answer for a specific question (defaults to 0)', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Topic A',
        questions: [
          { id: 'q1', title: 'Q1' },
          { id: 'q2', title: 'Q2' },
        ],
      },
    ]);

    // Only q1 answered
    const answers = makeAnswers([{ questionId: 'q1', score: 80 }]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    expect(result.topicScores[0].subTopicScores[0].questionScores[0].score).toBe(80);
    expect(result.topicScores[0].subTopicScores[0].questionScores[1].score).toBe(0);
    expect(result.topicScores[0].score).toBe(40); // (80+0)/2
  });

  // ─── showInReport Tests ──────────────────────────────────────────

  it('excludes showInReport=false topics from overall score', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Visible Topic',
        showInReport: true,
        questions: [{ id: 'q1', title: 'Q1' }],
      },
      {
        id: 'topic-2',
        name: 'Hidden Topic',
        showInReport: false,
        questions: [{ id: 'q2', title: 'Q2' }],
      },
    ]);

    const answers = makeAnswers([
      { questionId: 'q1', score: 80 },
      { questionId: 'q2', score: 20 },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    // Both topics have scores
    expect(result.topicScores).toHaveLength(2);
    expect(result.topicScores[0].score).toBe(80);
    expect(result.topicScores[1].score).toBe(20);

    // But overall only includes showInReport=true topics
    expect(result.overallScore).toBe(80);
  });

  it('includes showInReport and preferenceMode in TopicScore', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Topic A',
        showInReport: true,
        preferenceMode: 'CONTEXT',
        questions: [{ id: 'q1', title: 'Q1' }],
      },
    ]);

    const result = calculateScores('snap-1', 'ver-1', [], structure);

    expect(result.topicScores[0].showInReport).toBe(true);
    expect(result.topicScores[0].preferenceMode).toBe('CONTEXT');
  });

  // ─── FILTER Mode Tests ───────────────────────────────────────────

  it('scores FILTER topics by averaging SubTopic scores', () => {
    const structure = makeMultiSubTopicStructure([
      {
        id: 'topic-1',
        name: 'Self-Positioning',
        preferenceMode: 'FILTER',
        subTopics: [
          {
            id: 'st-businessman',
            name: 'Businessman',
            preferenceOptionId: 'opt-bus',
            dimensions: [
              {
                questions: [
                  { id: 'q1', title: 'Q1' },
                  { id: 'q2', title: 'Q2' },
                ],
              },
            ],
          },
          {
            id: 'st-entrepreneur',
            name: 'Entrepreneur',
            preferenceOptionId: 'opt-ent',
            dimensions: [
              {
                questions: [
                  { id: 'q3', title: 'Q3' },
                  { id: 'q4', title: 'Q4' },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const answers = makeAnswers([
      { questionId: 'q1', score: 80 },
      { questionId: 'q2', score: 60 },
      { questionId: 'q3', score: 40 },
      { questionId: 'q4', score: 20 },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    // SubTopic 1: (80+60)/2 = 70
    expect(result.topicScores[0].subTopicScores[0].score).toBe(70);
    // SubTopic 2: (40+20)/2 = 30
    expect(result.topicScores[0].subTopicScores[1].score).toBe(30);
    // Topic: (70+30)/2 = 50
    expect(result.topicScores[0].score).toBe(50);
  });

  // ─── REPEAT Mode Tests ──────────────────────────────────────────

  it('scores REPEAT topics with one SubTopicScore per preference selection', () => {
    const structure = makeMultiSubTopicStructure([
      {
        id: 'topic-1',
        name: 'Location Analysis',
        preferenceMode: 'REPEAT',
        subTopics: [
          {
            id: 'st-template',
            name: 'City Analysis',
            dimensions: [
              {
                questions: [
                  { id: 'q1', title: 'City positioning?' },
                  { id: 'q2', title: 'Key industries?' },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const answers = makeAnswers([
      // Beijing answers
      { questionId: 'q1', score: 80, preferenceOptionId: 'city-beijing' },
      { questionId: 'q2', score: 60, preferenceOptionId: 'city-beijing' },
      // Shanghai answers
      { questionId: 'q1', score: 90, preferenceOptionId: 'city-shanghai' },
      { questionId: 'q2', score: 70, preferenceOptionId: 'city-shanghai' },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    // Two SubTopicScores (one per preference selection)
    expect(result.topicScores[0].subTopicScores).toHaveLength(2);

    // Find scores by preferenceOptionId
    const beijingScore = result.topicScores[0].subTopicScores.find(
      (s) => s.preferenceOptionId === 'city-beijing',
    );
    const shanghaiScore = result.topicScores[0].subTopicScores.find(
      (s) => s.preferenceOptionId === 'city-shanghai',
    );

    expect(beijingScore?.score).toBe(70); // (80+60)/2
    expect(shanghaiScore?.score).toBe(80); // (90+70)/2

    // Topic score is average of instance scores: (70+80)/2 = 75
    expect(result.topicScores[0].score).toBe(75);
  });

  it('REPEAT mode with no answers returns empty subTopicScores', () => {
    const structure = makeMultiSubTopicStructure([
      {
        id: 'topic-1',
        name: 'Location',
        preferenceMode: 'REPEAT',
        subTopics: [
          {
            id: 'st-template',
            name: 'Template',
            dimensions: [
              { questions: [{ id: 'q1', title: 'Q1' }] },
            ],
          },
        ],
      },
    ]);

    const result = calculateScores('snap-1', 'ver-1', [], structure);

    expect(result.topicScores[0].subTopicScores).toHaveLength(0);
    expect(result.topicScores[0].score).toBe(0);
  });

  it('REPEAT mode with no template SubTopic returns score 0', () => {
    const structure = makeMultiSubTopicStructure([
      {
        id: 'topic-1',
        name: 'Empty REPEAT',
        preferenceMode: 'REPEAT',
        subTopics: [],
      },
    ]);

    const result = calculateScores('snap-1', 'ver-1', [], structure);

    expect(result.topicScores[0].score).toBe(0);
    expect(result.topicScores[0].subTopicScores).toEqual([]);
  });
});

// ─── calculateScoresFromMap Tests ────────────────────────────────────

describe('calculateScoresFromMap', () => {
  it('computes scores from a question-score map (CONTEXT mode)', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Topic A',
        questions: [
          { id: 'q1', title: 'Q1' },
          { id: 'q2', title: 'Q2' },
        ],
      },
    ]);

    const result = calculateScoresFromMap({ q1: 80, q2: 60 }, structure);

    expect(result.topicScores).toHaveLength(1);
    expect(result.topicScores[0].score).toBe(70);
    expect(result.overallScore).toBe(70);
  });

  it('excludes showInReport=false topics', () => {
    const structure = makeStructure([
      {
        id: 'topic-1',
        name: 'Visible',
        showInReport: true,
        questions: [{ id: 'q1', title: 'Q1' }],
      },
      {
        id: 'topic-2',
        name: 'Hidden',
        showInReport: false,
        questions: [{ id: 'q2', title: 'Q2' }],
      },
    ]);

    const result = calculateScoresFromMap({ q1: 80, q2: 20 }, structure);

    // Only visible topic included
    expect(result.topicScores).toHaveLength(1);
    expect(result.topicScores[0].topicId).toBe('topic-1');
    expect(result.overallScore).toBe(80);
  });

  it('handles REPEAT mode with composite keys', () => {
    const structure = makeMultiSubTopicStructure([
      {
        id: 'topic-1',
        name: 'Location',
        preferenceMode: 'REPEAT',
        subTopics: [
          {
            id: 'st-template',
            name: 'Template',
            dimensions: [
              {
                questions: [
                  { id: 'q1', title: 'Q1' },
                  { id: 'q2', title: 'Q2' },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const scoreMap = {
      'q1::city-beijing': 80,
      'q2::city-beijing': 60,
      'q1::city-shanghai': 90,
      'q2::city-shanghai': 70,
    };

    const result = calculateScoresFromMap(scoreMap, structure);

    // Should average all 4 scores: (80+60+90+70)/4 = 75
    expect(result.topicScores[0].score).toBe(75);
  });
});
