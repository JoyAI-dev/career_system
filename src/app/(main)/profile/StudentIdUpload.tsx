'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type StudentIdUploadProps = {
  hasUpload: boolean;
};

export function StudentIdUpload({ hasUpload }: StudentIdUploadProps) {
  const t = useTranslations('profile');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [uploaded, setUploaded] = useState(hasUpload);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setErrorMessage(t('selectFile'));
      setStatus('error');
      return;
    }

    // Client-side validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage(t('invalidFileType'));
      setStatus('error');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMessage(t('fileTooLarge'));
      setStatus('error');
      return;
    }

    setStatus('uploading');
    setErrorMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Upload failed');
      }

      setStatus('success');
      setUploaded(true);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed');
      setStatus('error');
    }
  }

  return (
    <div className="space-y-3">
      <Label htmlFor="student-id">{t('studentIdImage')}</Label>

      {uploaded && status !== 'success' && (
        <p className="text-sm text-muted-foreground">
          {t('studentIdUploaded')}
        </p>
      )}

      {status === 'success' && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
          {t('studentIdSuccess')}
        </div>
      )}

      {status === 'error' && errorMessage && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <Input
        id="student-id"
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={status === 'uploading'}
      />
      <p className="text-xs text-muted-foreground">
        {t('acceptedFormats')}
      </p>

      <Button
        type="button"
        onClick={handleUpload}
        disabled={status === 'uploading'}
        variant="outline"
      >
        {status === 'uploading' ? t('uploading') : t('uploadButton')}
      </Button>
    </div>
  );
}
