'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Activity,
  Calendar,
  User,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { href: '/activities', labelKey: 'activities', icon: Activity },
  { href: '/calendar', labelKey: 'calendar', icon: Calendar },
  { href: '/profile', labelKey: 'profile', icon: User },
];

const adminItems = [
  { href: '/admin', labelKey: 'admin', icon: ShieldCheck },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const t = useTranslations('nav');
  const isAdmin = session?.user?.role === 'ADMIN';

  const items = isAdmin ? [...navItems, ...adminItems] : navItems;

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      <div className="mb-4 px-3">
        <h2 className="text-lg font-semibold tracking-tight">{t('appName')}</h2>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </div>
      {items.map((item) => {
        const isActive =
          pathname === item.href || pathname.startsWith(item.href + '/');
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <item.icon className="h-4 w-4" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
