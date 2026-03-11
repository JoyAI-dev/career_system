import { SessionProvider } from '@/components/SessionProvider';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Separator } from '@/components/ui/separator';
import { auth } from '@/lib/auth';
import { getUnreadCount } from '@/server/queries/notification';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const unreadCount = session?.user ? await getUnreadCount(session.user.id) : 0;

  return (
    <SessionProvider>
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 flex-shrink-0 border-r bg-sidebar md:block">
          <Sidebar />
          <Separator />
        </aside>

        {/* Main content area */}
        <div className="flex flex-1 flex-col">
          <Header initialUnreadCount={unreadCount} />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
