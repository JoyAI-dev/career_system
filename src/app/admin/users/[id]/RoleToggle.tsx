'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { changeUserRole } from '@/server/actions/admin';

type Props = {
  userId: string;
  currentRole: string;
  username: string;
};

export function RoleToggle({ userId, currentRole, username }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const t = useTranslations('admin.users');

  const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';

  function handleToggle() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await changeUserRole(userId, newRole);
      if (result.error) {
        setError(result.error);
      }
      setConfirming(false);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm">
            {t('currentRole')}{' '}
            <span className={`font-semibold ${currentRole === 'ADMIN' ? 'text-primary' : ''}`}>
              {currentRole}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {confirming && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirming(false)}
              disabled={isPending}
            >
              {t('cancel')}
            </Button>
          )}
          <Button
            variant={confirming ? 'destructive' : 'outline'}
            size="sm"
            onClick={handleToggle}
            disabled={isPending}
          >
            {isPending
              ? t('changing')
              : confirming
                ? t('confirmMake', { username, role: newRole })
                : t('changeTo', { role: newRole })}
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
