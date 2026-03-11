import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="flex flex-col items-center gap-6 p-8">
        <h1 className="text-4xl font-bold tracking-tight">Career Exploration Platform</h1>
        <p className="text-lg text-muted-foreground">
          Student career exploration and activity management
        </p>
        <div className="flex gap-3">
          <Link href="/login">
            <Button size="lg">Sign In</Button>
          </Link>
          <Link href="/register">
            <Button size="lg" variant="outline">Register</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
