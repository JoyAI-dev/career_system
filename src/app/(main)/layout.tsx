import { redirect } from 'next/navigation';
import { SessionProvider } from '@/components/SessionProvider';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Separator } from '@/components/ui/separator';
import { AnnouncementPopup } from '@/components/AnnouncementPopup';
import { auth } from '@/lib/auth';
import { hasCompletedPreference } from '@/server/queries/preference';
import { hasCompletedQuestionnaire } from '@/server/queries/questionnaire';
import { getUnreadCount } from '@/server/queries/notification';
import { getActiveAnnouncement, hasUserViewedAnnouncement } from '@/server/queries/announcement';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.role === 'ADMIN';

  // Redirect non-admin users who haven't completed preferences or questionnaire
  if (session?.user && !isAdmin) {
    const hasPref = await hasCompletedPreference(session.user.id);
    if (!hasPref) {
      redirect('/preferences');
    }
    const completed = await hasCompletedQuestionnaire(session.user.id);
    if (!completed) {
      redirect('/questionnaire');
    }
  }

  const unreadCount = session?.user ? await getUnreadCount(session.user.id) : 0;

  // Announcement popup for non-admin users (always show, countdown only for first-time viewers)
  let announcementData: { id: string; title: string; content: string; countdownSeconds: number } | null = null;
  let hasViewed = false;

  if (!isAdmin && session?.user) {
    const announcement = await getActiveAnnouncement();
    if (announcement) {
      announcementData = announcement;
      hasViewed = await hasUserViewedAnnouncement(session.user.id, announcement.id);
    }
  }

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
            <Header initialUnreadCount={unreadCount} variant="admin" />
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
        <Header initialUnreadCount={unreadCount} variant="student" />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
      <AnnouncementPopup
        announcement={announcementData}
        hasViewed={hasViewed}
      />
    </SessionProvider>
  );
}
