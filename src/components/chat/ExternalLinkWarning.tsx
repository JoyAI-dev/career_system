'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ExternalLinkWarningProps {
  url: string;
}

export function ExternalLinkWarning({ url }: ExternalLinkWarningProps) {
  const [open, setOpen] = useState(false);
  const t = useTranslations('chat');

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-0.5 text-blue-500 underline hover:text-blue-700"
      >
        {url.length > 50 ? url.slice(0, 50) + '...' : url}
        <ExternalLink className="ml-0.5 inline h-3 w-3" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {t('externalLinkWarning')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600 leading-relaxed">
              {t('externalLinkDisclaimer')}
            </p>

            <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-4 text-center">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-sm font-medium text-blue-600 underline hover:text-blue-800"
                onClick={() => setOpen(false)}
              >
                {url}
              </a>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('goBack')}
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                window.open(url, '_blank', 'noopener,noreferrer');
                setOpen(false);
              }}
            >
              <ExternalLink className="mr-1.5 h-4 w-4" />
              {t('continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
