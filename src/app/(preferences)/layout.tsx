import { SessionProvider } from '@/components/SessionProvider';
import { AnnouncementPopup } from '@/components/AnnouncementPopup';
import { MiniToolbar } from '@/components/MiniToolbar';
import { auth } from '@/lib/auth';
import { getActiveAnnouncement, hasUserViewedAnnouncement } from '@/server/queries/announcement';

export default async function PreferencesLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.role === 'ADMIN';

  let announcementData: { id: string; title: string; content: string; countdownSeconds: number } | null = null;
  let hasViewed = false;

  if (!isAdmin && session?.user) {
    const announcement = await getActiveAnnouncement();
    if (announcement) {
      announcementData = announcement;
      hasViewed = await hasUserViewedAnnouncement(session.user.id, announcement.id);
    }
  }

  return (
    <SessionProvider>
      <div className="flex min-h-screen flex-col bg-muted/30">
        <div className="flex justify-end px-4 pt-3">
          <MiniToolbar />
        </div>
        <div className="flex flex-1 items-start justify-center">
          <div className="w-full max-w-4xl px-4 py-4 md:py-8">
            {children}
          </div>
        </div>
      </div>
      {!isAdmin && (
        <AnnouncementPopup
          announcement={announcementData}
          hasViewed={hasViewed}
        />
      )}
    </SessionProvider>
  );
}
