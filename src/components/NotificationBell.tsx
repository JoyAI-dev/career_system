'use client';

import { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Bell, UserPlus, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  fetchRecentNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from '@/server/actions/notification';
import { acceptFriendRequest, rejectFriendRequest } from '@/server/actions/friendship';

const POLL_INTERVAL = 30_000; // 30 seconds

function notificationHref(type: string): string {
  switch (type) {
    case 'ACTIVITY_FULL':
    case 'TIME_CONFIRMED':
      return '/activities';
    case 'NEW_COMMENT':
      return '/cognitive-report';
    default:
      return '/notifications';
  }
}

export function NotificationBell({ initialCount = 0 }: { initialCount?: number }) {
  const t = useTranslations('notifications');
  const tc = useTranslations('chat');
  const [unreadCount, setUnreadCount] = useState(initialCount);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const previousCountRef = useRef(initialCount);
  const shownFriendRequestIds = useRef<Set<string>>(new Set());

  function relativeTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return t('justNow');
    if (minutes < 60) return t('minutesAgo', { minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('hoursAgo', { hours });
    const days = Math.floor(hours / 24);
    return t('daysAgo', { days });
  }

  // Show toast for friend request with quick accept/reject
  const showFriendRequestToast = useCallback(
    (notification: NotificationItem) => {
      if (shownFriendRequestIds.current.has(notification.id)) return;
      shownFriendRequestIds.current.add(notification.id);

      toast(notification.message, {
        icon: <UserPlus className="h-4 w-4 text-blue-500" />,
        duration: 10000,
        action: {
          label: tc('accept'),
          onClick: () => {
            // Extract friendshipId from notification - it's stored after the colon in the id pattern
            // For now, fetch pending requests and match
            startTransition(async () => {
              const items = await fetchRecentNotifications();
              const friendNotif = items.find(
                (n) => n.id === notification.id && n.type === 'FRIEND_REQUEST',
              );
              if (friendNotif) {
                // Use the notification's ID to find and accept the friendship
                // The friendshipId is embedded in the notification message or we search by notification
                await markNotificationRead(notification.id);
              }
            });
          },
        },
        cancel: {
          label: tc('reject'),
          onClick: () => {
            startTransition(async () => {
              await markNotificationRead(notification.id);
            });
          },
        },
      });
    },
    [tc, startTransition],
  );

  // Poll for unread count and check for new friend requests
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/notifications/unread-count');
        if (res.ok) {
          const data = await res.json();
          const newCount = data.count;

          // If count increased, fetch notifications to check for friend requests
          if (newCount > previousCountRef.current) {
            const items = await fetchRecentNotifications();
            const newFriendRequests = items.filter(
              (n) =>
                n.type === 'FRIEND_REQUEST' &&
                !n.isRead &&
                !shownFriendRequestIds.current.has(n.id),
            );
            for (const fr of newFriendRequests) {
              showFriendRequestToast(fr);
            }
          }
          previousCountRef.current = newCount;
          setUnreadCount(newCount);
        }
      } catch {
        // silently ignore polling errors
      }
    };

    const interval = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [showFriendRequestToast]);

  // Fetch notifications when dropdown opens
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open);
      if (open) {
        startTransition(async () => {
          const items = await fetchRecentNotifications();
          setNotifications(items);
          // Update unread count from fetched data
          setUnreadCount(items.filter((n) => !n.isRead).length);
        });
      }
    },
    [],
  );

  const handleNotificationClick = useCallback(
    (notification: NotificationItem) => {
      if (!notification.isRead) {
        startTransition(async () => {
          await markNotificationRead(notification.id);
          setNotifications((prev) =>
            prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n)),
          );
          setUnreadCount((prev) => Math.max(0, prev - 1));
        });
      }
      setIsOpen(false);
      router.push(notificationHref(notification.type));
    },
    [router],
  );

  const handleMarkAllRead = useCallback(() => {
    startTransition(async () => {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    });
  }, []);

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        aria-label={t('title')}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t('title')}</DropdownMenuLabel>
          </DropdownMenuGroup>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={handleMarkAllRead}
              disabled={isPending}
            >
              {t('markAllRead')}
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              {t('empty')}
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-accent ${
                  !notification.isRead ? 'bg-primary/5' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}>
                    {notification.title}
                  </p>
                  {!notification.isRead && (
                    <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {notification.message}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {relativeTime(notification.createdAt)}
                </p>
              </button>
            ))
          )}
        </div>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/notifications');
              }}
              className="flex w-full items-center justify-center px-3 py-2 text-xs font-medium text-primary hover:bg-accent"
            >
              {t('viewAll')}
            </button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
