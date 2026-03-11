'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { addReflection } from '@/server/actions/reflection';

type Reflection = {
  id: string;
  content: string;
  activityTag: string | null;
  createdAt: string;
};

type Props = {
  questionId: string;
  initialReflections?: Reflection[];
  activityTag?: string;
  defaultExpanded?: boolean;
};

export function QuestionReflections({
  questionId,
  initialReflections = [],
  activityTag,
  defaultExpanded = true,
}: Props) {
  const t = useTranslations('reflections');
  const [reflections, setReflections] = useState<Reflection[]>(initialReflections);
  const [content, setContent] = useState('');
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(defaultExpanded);

  function handleSubmit() {
    if (!content.trim()) return;
    const text = content.trim();
    setContent('');
    startTransition(async () => {
      const result = await addReflection(questionId, text, activityTag);
      if (result.success) {
        setReflections((prev) => [
          {
            id: crypto.randomUUID(),
            content: text,
            activityTag: activityTag ?? null,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    });
  }

  return (
    <div className="mt-3 border-t pt-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <span>{expanded ? '▾' : '▸'}</span>
        <span>{t('title')}</span>
        {reflections.length > 0 && (
          <span className="ml-1 rounded-full bg-muted px-1.5 text-[10px]">
            {reflections.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {/* Existing reflections */}
          {reflections.map((r) => (
            <div key={r.id} className="rounded-md bg-muted/50 px-3 py-2 text-xs">
              <p className="text-foreground">{r.content}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(r.createdAt).toLocaleDateString()}
                {r.activityTag && (
                  <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                    {r.activityTag}
                  </span>
                )}
              </p>
            </div>
          ))}

          {/* Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={t('placeholder')}
              className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={isPending}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleSubmit}
              disabled={isPending || !content.trim()}
              className="h-auto px-3 py-1.5 text-xs"
            >
              {isPending ? t('adding') : t('add')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
