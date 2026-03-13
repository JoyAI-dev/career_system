import { redirect } from 'next/navigation';
import { SessionProvider } from '@/components/SessionProvider';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Separator } from '@/components/ui/separator';
import { AnnouncementPopup } from '@/components/AnnouncementPopup';
import { ActivityTracker } from '@/components/ActivityTracker';
import { TooltipProvider } from '@/components/ui/tooltip';
import { auth } from '@/lib/auth';
import { hasCompletedPreference } from '@/server/queries/preference';
import { hasCompletedQuestionnaire } from '@/server/queries/questionnaire';
import { getUnreadCount } from '@/server/queries/notification';
import { getActiveAnnouncement, hasUserViewedAnnouncement } from '@/server/queries/announcement';
import { getUserFriends } from '@/server/queries/friendship';
import { getUserChatGroups } from '@/server/queries/chatGroups';
import { ChatProvider } from '@/components/chat/ChatProvider';
import { SecondaryNavBar } from '@/components/SecondaryNavBar';
import { ChatPopup } from '@/components/chat/ChatPopup';
import { FloatingChatButton } from '@/components/chat/FloatingChatButton';
import { StudentNetworkDrawer } from '@/components/chat/StudentNetworkDrawer';

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

  // Chat data for all authenticated users
  const friends = session?.user
    ? await getUserFriends(session.user.id)
    : [];
  const groups = session?.user
    ? await getUserChatGroups(session.user.id)
    : [];

  if (isAdmin) {
    return (
      <SessionProvider>
        <TooltipProvider>
          <ActivityTracker />
          <ChatProvider
            userId={session!.user.id}
            username={session!.user.username}
            initialFriends={friends}
          >
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
            <FloatingChatButton />
            <ChatPopup userId={session!.user.id} />
            <StudentNetworkDrawer groups={groups} userId={session!.user.id} />
          </ChatProvider>
        </TooltipProvider>
      </SessionProvider>
    );
  }

  // Student layout — full-width, no sidebar, with secondary nav bar
  return (
    <SessionProvider>
      <TooltipProvider>
        <ActivityTracker />
        <ChatProvider
          userId={session!.user.id}
          username={session!.user.username}
          initialFriends={friends}
        >
          <div className="flex min-h-screen flex-col bg-[#F5F8FF]">
            <Header initialUnreadCount={unreadCount} variant="student" />
            <SecondaryNavBar />
            <main className="flex-1 p-4 md:p-6">{children}</main>
          </div>
          <FloatingChatButton />
          <ChatPopup userId={session!.user.id} />
          <StudentNetworkDrawer groups={groups} userId={session!.user.id} />
          <AnnouncementPopup
            announcement={announcementData}
            hasViewed={hasViewed}
          />
        </ChatProvider>
      </TooltipProvider>
    </SessionProvider>
  );
}
