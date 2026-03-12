'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Activity,
  Settings,
  Briefcase,
  GraduationCap,
  Megaphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const adminNavItems = [
  { href: '/admin', labelKey: 'adminDashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', labelKey: 'users', icon: Users },
  { href: '/admin/questionnaire', labelKey: 'questionnaire', icon: ClipboardList },
  { href: '/admin/activities', labelKey: 'adminActivities', icon: Activity },
  { href: '/admin/activity-types', labelKey: 'activityTypes', icon: Briefcase },
  { href: '/admin/grades', labelKey: 'grades', icon: GraduationCap },
  { href: '/admin/recruitment', labelKey: 'recruitment', icon: Briefcase },
  { href: '/admin/announcements', labelKey: 'announcements', icon: Megaphone },
  { href: '/admin/settings', labelKey: 'settings', icon: Settings },
];

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      <div className="mb-4 px-3">
        <h2 className="text-lg font-semibold tracking-tight">{t('appName')}</h2>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </div>
      {adminNavItems.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + '/');
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
