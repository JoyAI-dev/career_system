'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  Menu,
  LayoutDashboard,
  Activity,
  Calendar,
  ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/NotificationBell';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from '@/components/Sidebar';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ProfileDrawer } from '@/components/ProfileDrawer';

const studentNavItems = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/activities', labelKey: 'activities', icon: Activity },
  { href: '/calendar', labelKey: 'calendar', icon: Calendar },
  { href: '/cognitive-report', labelKey: 'cognitiveReport', icon: ClipboardList },
] as const;

interface HeaderProps {
  initialUnreadCount?: number;
  variant?: 'admin' | 'student';
}

export function Header({ initialUnreadCount = 0, variant = 'admin' }: HeaderProps) {
  const { data: session } = useSession();
  const t = useTranslations('header');
  const tn = useTranslations('nav');
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const username = session?.user?.username ?? 'User';
  const role = session?.user?.role ?? 'USER';
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 md:px-6">
      {variant === 'admin' ? (
        /* Admin: Mobile sidebar trigger */
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring outline-none md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">{t('toggleNavigation')}</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">{t('navigation')}</SheetTitle>
            <Sidebar onNavigate={() => setSheetOpen(false)} />
          </SheetContent>
        </Sheet>
      ) : (
        /* Student: Horizontal nav tabs */
        <nav role="tablist" className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {studentNavItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden md:inline">{tn(item.labelKey)}</span>
                <span className="sr-only md:hidden">{tn(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      )}

      <div className="flex-1" />

      {/* Language switcher */}
      <LanguageSwitcher />

      {/* Notification bell */}
      <NotificationBell initialCount={initialUnreadCount} />

      {/* User avatar — opens profile drawer */}
      <button
        type="button"
        onClick={() => setProfileOpen(true)}
        className="relative flex h-8 w-8 items-center justify-center rounded-full hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none"
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
      </button>

      <ProfileDrawer
        open={profileOpen}
        onOpenChange={setProfileOpen}
        username={username}
        role={role}
      />
    </header>
  );
}
