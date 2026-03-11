import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { auth } from '@/lib/auth';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: Record<string, unknown> = {};

  // 1. Test auth/session
  try {
    const session = await auth();
    results.session = session ? { id: session.user?.id, role: session.user?.role, username: session.user?.username } : null;
  } catch (e) {
    results.sessionError = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
  }

  // 2. Test getActivities query (exact same as the activities page)
  try {
    const activities = await prisma.activity.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        type: { select: { id: true, name: true } },
        creator: { select: { id: true, name: true, username: true } },
        activityTags: {
          include: { tag: { select: { id: true, name: true } } },
        },
        _count: { select: { memberships: true } },
      },
    });
    results.activities = activities.map(a => ({
      id: a.id,
      title: a.title,
      createdBy: a.createdBy,
      creatorId: a.creator?.id,
      creatorName: a.creator?.username,
      typeId: a.typeId,
      typeName: a.type?.name,
      status: a.status,
      tagsCount: a.activityTags.length,
      membersCount: a._count.memberships,
    }));
  } catch (e) {
    results.activitiesError = e instanceof Error ? `${e.constructor.name}: ${e.message}\n${e.stack?.slice(0, 500)}` : String(e);
  }

  // 3. Test getTranslations
  try {
    const tv = await getTranslations('validation');
    results.translationValidation = tv('titleRequired');
  } catch (e) {
    results.translationError = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
  }

  // 4. Test getActivityTypes
  try {
    const types = await prisma.activityType.findMany({
      orderBy: { order: 'asc' },
      include: { prerequisiteType: { select: { id: true, name: true } } },
    });
    results.activityTypes = types.map(t => ({ id: t.id, name: t.name, isEnabled: t.isEnabled }));
  } catch (e) {
    results.activityTypesError = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
  }

  // 5. Test getTags
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { activityTags: true } } },
    });
    results.tags = tags.map(t => ({ id: t.id, name: t.name }));
  } catch (e) {
    results.tagsError = e instanceof Error ? `${e.constructor.name}: ${e.message}` : String(e);
  }

  return NextResponse.json(results, { status: 200 });
}
