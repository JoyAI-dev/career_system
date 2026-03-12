import { cookies } from 'next/headers';
import { SessionProvider } from '@/components/SessionProvider';
import { AnnouncementPopup } from '@/components/AnnouncementPopup';
import { auth } from '@/lib/auth';
import { getActiveAnnouncement, hasUserViewedAnnouncement } from '@/server/queries/announcement';

export default async function QuestionnaireLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const isAdmin = session?.user?.role === 'ADMIN';

  let announcementData: { id: string; title: string; content: string; countdownSeconds: number } | null = null;
  let forceCountdown = false;

  if (!isAdmin && session?.user) {
    const announcement = await getActiveAnnouncement();
    if (announcement) {
      const viewed = await hasUserViewedAnnouncement(session.user.id, announcement.id);
      if (!viewed) {
        announcementData = announcement;
        const cookieStore = await cookies();
        forceCountdown = cookieStore.get('just_registered')?.value === '1';
      }
    }
  }

  return (
    <SessionProvider>
      <div className="flex min-h-screen items-start justify-center bg-muted/30">
        <div className="w-full max-w-3xl px-4 py-8 md:py-12">
          {children}
        </div>
      </div>
      {!isAdmin && (
        <AnnouncementPopup
          announcement={announcementData}
          forceCountdown={forceCountdown}
        />
      )}
    </SessionProvider>
  );
}
