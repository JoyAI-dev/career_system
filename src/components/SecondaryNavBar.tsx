'use client';

import { useTranslations } from 'next-intl';
import { Users, CalendarHeart, CalendarRange, Share2, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChat } from '@/components/chat/ChatProvider';

interface NavItem {
  labelKey: string;
  icon: typeof Users;
  disabled?: boolean;
  action: 'network' | 'chat' | 'disabled';
  color: string;
}

const navItems: NavItem[] = [
  { labelKey: 'studentNetwork', icon: Users, action: 'network', color: 'text-blue-600' },
  { labelKey: 'shareCalendar', icon: CalendarHeart, disabled: true, action: 'disabled', color: 'text-gray-400' },
  { labelKey: 'crossCalendar', icon: CalendarRange, disabled: true, action: 'disabled', color: 'text-gray-400' },
  { labelKey: 'shareActivities', icon: Share2, disabled: true, action: 'disabled', color: 'text-gray-400' },
  { labelKey: 'friendChat', icon: MessageCircle, action: 'chat', color: 'text-blue-600' },
];

export function SecondaryNavBar() {
  const t = useTranslations('secondaryNav');
  const { openChat, setNetworkDrawerOpen, unreadTotal } = useChat();

  const handleClick = (item: NavItem) => {
    if (item.disabled) return;
    if (item.action === 'network') {
      setNetworkDrawerOpen(true);
    } else if (item.action === 'chat') {
      openChat();
    }
  };

  return (
    <div className="mx-4 md:mx-6 mt-2">
      <nav className="flex items-center justify-center gap-2 rounded-xl bg-white/80 backdrop-blur-sm border border-gray-100 px-4 py-3 shadow-sm">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isChat = item.action === 'chat';

          const button = (
            <button
              key={item.labelKey}
              onClick={() => handleClick(item)}
              disabled={item.disabled}
              className={cn(
                'flex flex-col items-center gap-1.5 px-6 py-2 rounded-lg transition-all min-w-[80px]',
                item.disabled
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:bg-blue-50/80 active:scale-95 cursor-pointer',
              )}
            >
              <div className="relative">
                <Icon
                  className={cn(
                    'h-6 w-6 transition-colors',
                    item.disabled ? 'text-gray-300' : item.color,
                  )}
                  strokeWidth={1.8}
                />
                {isChat && unreadTotal > 0 && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadTotal > 99 ? '99+' : unreadTotal}
                  </span>
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium',
                  item.disabled ? 'text-gray-300' : 'text-gray-700',
                )}
              >
                {t(item.labelKey)}
              </span>
            </button>
          );

          if (item.disabled) {
            return (
              <Tooltip key={item.labelKey}>
                <TooltipTrigger render={<span />}>
                  {button}
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('comingSoon')}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return button;
        })}
      </nav>
    </div>
  );
}
