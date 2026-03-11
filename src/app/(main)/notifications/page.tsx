import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getNotifications } from '@/server/queries/notification';
import { NotificationList } from './NotificationList';

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const notifications = await getNotifications(session.user.id, { take: 50 });

  const serialized = notifications.map((n: { id: string; type: unknown; title: string; message: string; isRead: boolean; createdAt: Date }) => ({
    id: n.id,
    type: String(n.type),
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="container mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Notifications</h1>
      <NotificationList notifications={serialized} />
    </div>
  );
}
