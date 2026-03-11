import { redirect } from 'next/navigation';
import { SessionProvider } from '@/components/SessionProvider';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { Separator } from '@/components/ui/separator';
import { auth } from '@/lib/auth';
import { hasCompletedQuestionnaire } from '@/server/queries/questionnaire';

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  // Redirect non-admin users who haven't completed the questionnaire
  if (session?.user && session.user.role !== 'ADMIN') {
    const completed = await hasCompletedQuestionnaire(session.user.id);
    if (!completed) {
      redirect('/questionnaire');
    }
  }

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
          <Header />
          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
