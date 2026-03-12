'use client';

import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function MiniToolbar() {
  const t = useTranslations('header');

  return (
    <div className="flex items-center gap-1">
      <LanguageSwitcher />
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground hover:text-foreground"
        onClick={() => signOut({ callbackUrl: '/login' })}
        title={t('logOut')}
      >
        <LogOut className="h-4 w-4" />
        <span className="sr-only">{t('logOut')}</span>
      </Button>
    </div>
  );
}
