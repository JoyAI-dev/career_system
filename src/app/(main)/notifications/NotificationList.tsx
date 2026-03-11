'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from '@/server/actions/notification';

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

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

export function NotificationList({ notifications }: { notifications: NotificationItem[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const hasUnread = notifications.some((n) => !n.isRead);

  const handleClick = (notification: NotificationItem) => {
    if (!notification.isRead) {
      startTransition(async () => {
        await markNotificationRead(notification.id);
      });
    }
    router.push(notificationHref(notification.type));
  };

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  };

  if (notifications.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Bell className="mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No notifications yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {hasUnread && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isPending}
          >
            Mark all as read
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {notifications.map((notification) => (
          <button
            key={notification.id}
            onClick={() => handleClick(notification)}
            className={`flex w-full flex-col gap-1 rounded-lg border p-4 text-left transition-colors hover:bg-accent ${
              !notification.isRead
                ? 'border-primary/20 bg-primary/5'
                : 'border-border'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}>
                {notification.title}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {relativeTime(notification.createdAt)}
                </span>
                {!notification.isRead && (
                  <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{notification.message}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
