import { auth } from '@/lib/auth';
import { getUnreadCount } from '@/server/queries/notification';
import { NextResponse } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ count: 0 }, { status: 401 });
  }

  const count = await getUnreadCount(session.user.id);
  return NextResponse.json({ count });
}
