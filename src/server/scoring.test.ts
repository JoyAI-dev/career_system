import { describe, it, expect } from 'vitest';
import { calculateScores } from './scoring';

// ─── Helpers ─────────────────────────────────────────────────────────

function makeStructure(topics: { id: string; name: string; questions: { id: string; title: string }[] }[]) {
  return {
    topics: topics.map((t) => ({
      id: t.id,
      name: t.name,
      dimensions: [
        {
          questions: t.questions,
        },
      ],
    })),
  };
}

function makeAnswers(entries: { questionId: string; score: number }[]) {
  return entries.map((e) => ({
    questionId: e.questionId,
    selectedOption: { score: e.score },
  }));
}

// ─── Tests ───────────────────────────────────────────────────────────

describe('calculateScores', () => {
  it('calculates topic score as average of question scores', () => {
    // Example from acceptance: Q1=60, Q2=80, Q3=40 → Topic Score = 60
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

  it('returns per-question scores correctly', () => {
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

    expect(result.topicScores[0].questionScores).toEqual([
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
    expect(result.topicScores[0].questionScores[0].score).toBe(0);
    expect(result.topicScores[0].questionScores[1].score).toBe(0);
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
    expect(result.topicScores[0].questionScores).toEqual([]);
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

    // q2 answer exists but q2 is not in the version structure
    const answers = makeAnswers([
      { questionId: 'q1', score: 80 },
      { questionId: 'q2', score: 100 },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    expect(result.topicScores[0].score).toBe(80);
    expect(result.topicScores[0].questionScores).toHaveLength(1);
    expect(result.overallScore).toBe(80);
  });

  it('handles multiple dimensions within a topic', () => {
    const structure = {
      topics: [
        {
          id: 'topic-1',
          name: 'Topic A',
          dimensions: [
            {
              questions: [
                { id: 'q1', title: 'Q1' },
                { id: 'q2', title: 'Q2' },
              ],
            },
            {
              questions: [
                { id: 'q3', title: 'Q3' },
              ],
            },
          ],
        },
      ],
    };

    const answers = makeAnswers([
      { questionId: 'q1', score: 60 },
      { questionId: 'q2', score: 90 },
      { questionId: 'q3', score: 30 },
    ]);

    const result = calculateScores('snap-1', 'ver-1', answers, structure);

    // All 3 questions averaged: (60+90+30)/3 = 60
    expect(result.topicScores[0].score).toBe(60);
    expect(result.topicScores[0].questionScores).toHaveLength(3);
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

    expect(result.topicScores[0].questionScores[0].score).toBe(80);
    expect(result.topicScores[0].questionScores[1].score).toBe(0);
    expect(result.topicScores[0].score).toBe(40); // (80+0)/2
  });
});
