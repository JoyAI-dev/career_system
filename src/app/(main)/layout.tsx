import { redirect } from 'next/navigation';
import { SessionProvider } from '@/components/SessionProvider';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Separator } from '@/components/ui/separator';
import { auth } from '@/lib/auth';
import { hasCompletedQuestionnaire } from '@/server/queries/questionnaire';
import { getUnreadCount } from '@/server/queries/notification';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.role === 'ADMIN';

  // Redirect non-admin users who haven't completed the questionnaire
  if (session?.user && !isAdmin) {
    const completed = await hasCompletedQuestionnaire(session.user.id);
    if (!completed) {
      redirect('/questionnaire');
    }
  }

  const unreadCount = session?.user ? await getUnreadCount(session.user.id) : 0;

  if (isAdmin) {
    return (
      <SessionProvider>
        <div className="flex min-h-screen">
          {/* Desktop sidebar — admin only */}
          <aside className="hidden w-64 flex-shrink-0 border-r bg-sidebar md:block">
            <Sidebar />
            <Separator />
          </aside>

          <div className="flex flex-1 flex-col">
            <Header initialUnreadCount={unreadCount} />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
        </div>
      </SessionProvider>
    );
  }

  // Student layout — full-width, no sidebar
  return (
    <SessionProvider>
      <div className="flex min-h-screen flex-col bg-[#F5F8FF]">
        <Header initialUnreadCount={unreadCount} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </SessionProvider>
  );
}
