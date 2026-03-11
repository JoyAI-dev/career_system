'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

type Props = {
  userId: string;
};

export function StudentIdButton({ userId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('admin.users');

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/student-id?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || t('failedLoadStudentId'));
        return;
      }
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch {
      setError(t('failedLoadStudentId'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? t('loadingStudentId') : t('viewStudentId')}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
