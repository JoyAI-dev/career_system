'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AnswerComments } from '@/components/AnswerComments';

type Comment = {
  id: string;
  content: string;
  activityTag: string | null;
  createdAt: string;
};

type Answer = {
  id: string;
  questionId: string;
  selectedOption: { id: string; label: string; score: number };
  question: {
    id: string;
    title: string;
    dimension: {
      id: string;
      name: string;
      topic: { id: string; name: string };
    };
  };
  comments: Comment[];
};

type DimensionGroup = {
  dimensionId: string;
  dimensionName: string;
  answers: Answer[];
};

type TopicGroup = {
  topicId: string;
  topicName: string;
  dimensions: DimensionGroup[];
};

type Props = {
  grouped: TopicGroup[];
  activityTag?: string;
};

export function SnapshotDetailClient({ grouped, activityTag }: Props) {
  const [expandedAnswers, setExpandedAnswers] = useState<Set<string>>(new Set());

  function toggleAnswer(answerId: string) {
    setExpandedAnswers((prev) => {
      const next = new Set(prev);
      if (next.has(answerId)) {
        next.delete(answerId);
      } else {
        next.add(answerId);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {grouped.map((topic) => (
        <Card key={topic.topicId}>
          <CardHeader>
            <CardTitle>{topic.topicName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {topic.dimensions.map((dim) => (
              <div key={dim.dimensionId}>
                <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                  {dim.dimensionName}
                </h3>
                <div className="space-y-2">
                  {dim.answers.map((answer) => {
                    const isExpanded = expandedAnswers.has(answer.id);
                    const commentCount = answer.comments.length;

                    return (
                      <div
                        key={answer.id}
                        className="rounded-lg border border-border p-3"
                      >
                        <div
                          className="flex cursor-pointer items-center justify-between"
                          onClick={() => toggleAnswer(answer.id)}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {answer.question.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {answer.selectedOption.label} (score: {answer.selectedOption.score})
                            </p>
                          </div>
                          <div className="ml-2 flex items-center gap-2">
                            {commentCount > 0 && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                                {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {isExpanded ? '▼' : '▶'}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <AnswerComments
                            responseAnswerId={answer.id}
                            comments={answer.comments}
                            activityTag={activityTag}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
