import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserProfile, getActiveGradeOptions } from '@/server/queries/user';
import { hasCompletedQuestionnaire } from '@/server/queries/questionnaire';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [user, gradeOptions, hasCompleted] = await Promise.all([
    getUserProfile(session.user.id),
    getActiveGradeOptions(),
    hasCompletedQuestionnaire(session.user.id),
  ]);

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({ user, gradeOptions, hasCompleted });
}
