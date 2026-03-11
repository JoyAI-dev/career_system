import { SessionProvider } from '@/components/SessionProvider';

export default function QuestionnaireLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen items-start justify-center bg-muted/30">
        <div className="w-full max-w-3xl px-4 py-8 md:py-12">
          {children}
        </div>
      </div>
    </SessionProvider>
  );
}
