'use client';

import { useState, useTransition } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { fetchLeaderGuide } from '@/server/actions/announcement';

/**
 * Button that allows group leaders to view the leader guide on demand.
 * Fetches the active leader guide content via server action when clicked.
 */
export function LeaderGuideButton() {
  const t = useTranslations('leaderGuide');
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [guide, setGuide] = useState<{ title: string; content: string } | null>(null);

  function handleOpen() {
    startTransition(async () => {
      const data = await fetchLeaderGuide();
      if (data) {
        setGuide(data);
        setOpen(true);
      }
    });
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        disabled={isPending}
        className="gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-50"
      >
        <BookOpen className="size-3.5" />
        {isPending ? t('loading') : t('viewGuide')}
      </Button>

      {guide && open && (
        <Dialog
          defaultOpen
          modal
          onOpenChange={() => setOpen(false)}
        >
          <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{guide.title}</DialogTitle>
            </DialogHeader>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {guide.content}
              </ReactMarkdown>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={() => setOpen(false)}>{t('close')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
