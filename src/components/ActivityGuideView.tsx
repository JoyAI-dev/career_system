'use client';

/**
 * ActivityGuideView
 * Renders the meeting guide content from ActivityType.guideContent.
 * Falls back to Activity.guideMarkdown if guideContent is not available.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Lock } from 'lucide-react';

interface ActivityGuideViewProps {
  guideContent?: string | null;
  guideMarkdown?: string | null;
  allowView: boolean;
}

export function ActivityGuideView({
  guideContent,
  guideMarkdown,
  allowView,
}: ActivityGuideViewProps) {
  const content = guideContent ?? guideMarkdown;

  if (!content && allowView) return null;

  if (!allowView) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-3 text-sm text-yellow-800">
        <Lock className="size-4 shrink-0" />
        <span>活动解锁后可查看指南内容</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5">
        <BookOpen className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">活动指南</h3>
      </div>
      <div className="prose prose-sm max-w-none overflow-hidden break-words rounded-md bg-muted/30 p-3 [&_pre]:overflow-x-auto [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_li]:my-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
