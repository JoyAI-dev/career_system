'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, requireAuth, auth } from '@/lib/auth';
import { getUnlockedTypeIds } from '@/server/queries/activity';
import { validateTransition, type TransitionAction } from '@/server/stateMachine';
import { revalidatePath } from 'next/cache';
import { notifyActivityMembers } from '@/server/notifications';
import { Prisma } from '@prisma/client';
import type { ActivityStatus, MemberRole } from '@prisma/client';
import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';

const ADMIN_PATH = '/admin/activities';

export type ActionState = {
  errors?: { [key: string]: string[] };
  success?: boolean;
};

function getCreateActivitySchema(t: (key: string) => string) {
  return z.object({
    typeId: z.string().min(1, t('activityTypeRequired')),
    title: z.string().min(1, t('titleRequired')).max(200),
    capacity: z.coerce.number().int().min(1, t('capacityMin')),
    guideMarkdown: z.string().optional(),
    location: z.string().optional(),
    isOnline: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
    tagIds: z.array(z.string()).optional(),
  });
}

function getUpdateActivitySchema(t: (key: string) => string) {
  return z.object({
    id: z.string().min(1),
    typeId: z.string().min(1, t('activityTypeRequired')),
    title: z.string().min(1, t('titleRequired')).max(200),
    capacity: z.coerce.number().int().min(1, t('capacityMin')),
    guideMarkdown: z.string().optional(),
    location: z.string().optional(),
    isOnline: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
    tagIds: z.array(z.string()).optional(),
  });
}

export async function createActivity(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const session = await auth();
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const createActivitySchema = getCreateActivitySchema(tv);

  const tagIds = formData.getAll('tagIds').map(String);

  const parsed = createActivitySchema.safeParse({
    typeId: formData.get('typeId'),
    title: formData.get('title'),
    capacity: formData.get('capacity'),
    guideMarkdown: formData.get('guideMarkdown') || undefined,
    location: formData.get('location') || undefined,
    isOnline: formData.get('isOnline'),
    tagIds,
  });

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const type = await prisma.activityType.findUnique({ where: { id: parsed.data.typeId } });
  if (!type || !type.isEnabled) {
    return { errors: { typeId: [te('invalidActivityType')] } };
  }

  await prisma.activity.create({
    data: {
      typeId: parsed.data.typeId,
      title: parsed.data.title,
      capacity: parsed.data.capacity,
      guideMarkdown: parsed.data.guideMarkdown || null,
      location: parsed.data.location || null,
      isOnline: parsed.data.isOnline ?? false,
      createdBy: session!.user.id,
      activityTags: parsed.data.tagIds?.length
        ? {
            create: parsed.data.tagIds.map((tagId) => ({ tagId })),
          }
        : undefined,
    },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function updateActivity(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const updateActivitySchema = getUpdateActivitySchema(tv);

  const tagIds = formData.getAll('tagIds').map(String);

  const parsed = updateActivitySchema.safeParse({
    id: formData.get('id'),
    typeId: formData.get('typeId'),
    title: formData.get('title'),
    capacity: formData.get('capacity'),
    guideMarkdown: formData.get('guideMarkdown') || undefined,
    location: formData.get('location') || undefined,
    isOnline: formData.get('isOnline'),
    tagIds,
  });

  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const existing = await prisma.activity.findUnique({
    where: { id: parsed.data.id },
    include: { _count: { select: { memberships: true } } },
  });
  if (!existing) {
    return { errors: { _form: [te('activityNotFound')] } };
  }
  if (existing.status !== 'OPEN') {
    return { errors: { _form: [te('canOnlyEditOpen')] } };
  }
  if (parsed.data.capacity < existing._count.memberships) {
    return {
      errors: {
        capacity: [te('capacityBelowMembers', { count: existing._count.memberships.toString() })],
      },
    };
  }

  const type = await prisma.activityType.findUnique({ where: { id: parsed.data.typeId } });
  if (!type || !type.isEnabled) {
    return { errors: { typeId: [te('invalidActivityType')] } };
  }

  await prisma.$transaction([
    prisma.activityTag.deleteMany({ where: { activityId: parsed.data.id } }),
    prisma.activity.update({
      where: { id: parsed.data.id },
      data: {
        typeId: parsed.data.typeId,
        title: parsed.data.title,
        capacity: parsed.data.capacity,
        guideMarkdown: parsed.data.guideMarkdown || null,
        location: parsed.data.location || null,
        isOnline: parsed.data.isOnline ?? false,
        activityTags: parsed.data.tagIds?.length
          ? {
              create: parsed.data.tagIds.map((tagId) => ({ tagId })),
            }
          : undefined,
      },
    }),
  ]);

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteActivity(id: string): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const existing = await prisma.activity.findUnique({
    where: { id },
    include: { _count: { select: { memberships: true } } },
  });
  if (!existing) {
    return { errors: { _form: [te('activityNotFound')] } };
  }
  if (existing._count.memberships > 0) {
    return {
      errors: { _form: [te('cannotDeleteWithMembers', { count: existing._count.memberships.toString() })] },
    };
  }

  await prisma.activity.delete({ where: { id } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

const ACTIVITIES_PATH = '/activities';

/**
 * Join an activity with concurrency-safe capacity check.
 * Uses an interactive Prisma transaction with row-level locking.
 * First member becomes LEADER, subsequent members are MEMBER.
 * Activity status transitions to FULL when capacity is reached.
 */
export async function joinActivity(activityId: string): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;
  const te = await getTranslations('serverErrors');

  try {
    await prisma.$transaction(async (tx) => {
      // Lock the activity row for update to prevent concurrent joins exceeding capacity
      const activities = await tx.$queryRaw<
        { id: string; typeId: string; capacity: number; status: string }[]
      >(
        Prisma.sql`SELECT id, "typeId", capacity, status FROM activities WHERE id = ${activityId} FOR UPDATE`,
      );

      if (activities.length === 0) {
        throw new Error(te('activityNotFound'));
      }
      const activity = activities[0];

      if (activity.status !== 'OPEN') {
        throw new Error(te('activityNotOpen'));
      }

      // Check progressive unlock
      const unlockedTypeIds = await getUnlockedTypeIds(userId);
      if (!unlockedTypeIds.has(activity.typeId)) {
        throw new Error(te('prerequisiteNotMet'));
      }

      // Check if already a member (unique constraint backup)
      const existingMembership = await tx.membership.findUnique({
        where: { activityId_userId: { activityId, userId } },
      });
      if (existingMembership) {
        throw new Error(te('alreadyJoined'));
      }

      // Count current members (within the lock scope)
      const memberCount = await tx.membership.count({ where: { activityId } });
      if (memberCount >= activity.capacity) {
        throw new Error(te('activityFull'));
      }

      // First member becomes LEADER, others are MEMBER
      const role = memberCount === 0 ? 'LEADER' : 'MEMBER';

      await tx.membership.create({
        data: { activityId, userId, role },
      });

      // Transition to FULL if at capacity
      if (memberCount + 1 >= activity.capacity) {
        await tx.activity.update({
          where: { id: activityId },
          data: { status: 'FULL' },
        });

        // Fetch activity title for notification
        const activityData = await tx.activity.findUnique({
          where: { id: activityId },
          select: { title: true },
        });
        const title = activityData?.title ?? 'Activity';

        await notifyActivityMembers(
          activityId,
          'ACTIVITY_FULL',
          te('notificationActivityFull'),
          te('notificationActivityFullMsg', { title }),
          tx,
        );
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : te('failedToJoin');
    return { errors: { _form: [message] } };
  }

  revalidatePath(ACTIVITIES_PATH);
  return { success: true };
}

/**
 * Join an activity type. Finds an open instance with capacity or creates a new one.
 * Uses a Prisma transaction for atomicity:
 * - If an OPEN instance with capacity exists → join as MEMBER
 * - If no open instance → create new instance, join as LEADER
 * - When an instance reaches capacity → auto-transition to FULL
 */
export async function joinActivityType(typeId: string): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;
  const te = await getTranslations('serverErrors');

  try {
    await prisma.$transaction(async (tx) => {
      // Verify type exists and is enabled
      const type = await tx.activityType.findUnique({
        where: { id: typeId },
        select: { id: true, name: true, defaultCapacity: true, isEnabled: true },
      });
      if (!type || !type.isEnabled) {
        throw new Error(te('invalidActivityType'));
      }

      // Check progressive unlock
      const unlockedTypeIds = await getUnlockedTypeIds(userId);
      if (!unlockedTypeIds.has(typeId)) {
        throw new Error(te('prerequisiteNotMet'));
      }

      // Check if user is already a member of any active instance of this type
      const existingMembership = await tx.membership.findFirst({
        where: {
          userId,
          activity: {
            typeId,
            status: { in: ['OPEN', 'FULL', 'SCHEDULED', 'IN_PROGRESS'] },
          },
        },
      });
      if (existingMembership) {
        throw new Error(te('alreadyJoined'));
      }

      // Find an OPEN instance with capacity (lock rows to prevent race conditions)
      const openInstances = await tx.$queryRaw<
        { id: string; capacity: number; title: string }[]
      >(
        Prisma.sql`
          SELECT a.id, a.capacity, a.title
          FROM activities a
          WHERE a."typeId" = ${typeId}
            AND a.status = 'OPEN'
          ORDER BY a."createdAt" ASC
          FOR UPDATE
        `,
      );

      let targetActivityId: string | null = null;
      let role: 'LEADER' | 'MEMBER' = 'MEMBER';

      for (const instance of openInstances) {
        const memberCount = await tx.membership.count({
          where: { activityId: instance.id },
        });
        if (memberCount < instance.capacity) {
          targetActivityId = instance.id;
          role = memberCount === 0 ? 'LEADER' : 'MEMBER';
          break;
        }
      }

      if (!targetActivityId) {
        // No open instance with capacity — create a new one
        const instanceCount = await tx.activity.count({ where: { typeId } });
        const newActivity = await tx.activity.create({
          data: {
            typeId,
            title: `${type.name} #${instanceCount + 1}`,
            capacity: type.defaultCapacity,
            status: 'OPEN',
            createdBy: userId,
          },
        });
        targetActivityId = newActivity.id;
        role = 'LEADER';
      }

      // Create membership
      await tx.membership.create({
        data: { activityId: targetActivityId, userId, role },
      });

      // Check if instance is now full
      const newMemberCount = await tx.membership.count({
        where: { activityId: targetActivityId },
      });
      const activity = await tx.activity.findUnique({
        where: { id: targetActivityId },
        select: { capacity: true, title: true },
      });

      if (activity && newMemberCount >= activity.capacity) {
        await tx.activity.update({
          where: { id: targetActivityId },
          data: { status: 'FULL' },
        });

        await notifyActivityMembers(
          targetActivityId,
          'ACTIVITY_FULL',
          te('notificationActivityFull'),
          te('notificationActivityFullMsg', { title: activity.title }),
          tx,
        );
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : te('failedToJoin');
    return { errors: { _form: [message] } };
  }

  revalidatePath('/dashboard');
  revalidatePath(ACTIVITIES_PATH);
  return { success: true };
}

/**
 * Leave an activity. If the activity was FULL, revert to OPEN.
 * Leader cannot leave unless they are the only member.
 * If leader leaves as last member, activity reverts to OPEN.
 */
export async function leaveActivity(activityId: string): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;
  const te = await getTranslations('serverErrors');

  try {
    await prisma.$transaction(async (tx) => {
      // Lock activity row
      const activities = await tx.$queryRaw<
        { id: string; capacity: number; status: string }[]
      >(
        Prisma.sql`SELECT id, capacity, status FROM activities WHERE id = ${activityId} FOR UPDATE`,
      );

      if (activities.length === 0) {
        throw new Error(te('activityNotFound'));
      }
      const activity = activities[0];

      const membership = await tx.membership.findUnique({
        where: { activityId_userId: { activityId, userId } },
      });
      if (!membership) {
        throw new Error(te('notMember'));
      }

      // Leader cannot leave if there are other members
      if (membership.role === 'LEADER') {
        const memberCount = await tx.membership.count({ where: { activityId } });
        if (memberCount > 1) {
          throw new Error(te('leaderCannotLeave'));
        }
      }

      await tx.membership.delete({
        where: { id: membership.id },
      });

      // Revert FULL → OPEN if leaving freed a spot
      if (activity.status === 'FULL') {
        await tx.activity.update({
          where: { id: activityId },
          data: { status: 'OPEN' },
        });
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : te('failedToLeave');
    return { errors: { _form: [message] } };
  }

  revalidatePath(ACTIVITIES_PATH);
  return { success: true };
}

function getScheduleSchema(t: (key: string) => string) {
  return z.object({
    activityId: z.string().min(1),
    scheduledAt: z.coerce.date({ error: t('meetingDateRequired') }),
    location: z.string().optional(),
    isOnline: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  });
}

/**
 * Schedule a meeting (FULL → SCHEDULED).
 * Leader sets date/time, location, and online/offline.
 */
export async function scheduleMeeting(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const locale = await getLocale();
  const scheduleSchema = getScheduleSchema(tv);

  const parsed = scheduleSchema.safeParse({
    activityId: formData.get('activityId'),
    scheduledAt: formData.get('scheduledAt'),
    location: formData.get('location') || undefined,
    isOnline: formData.get('isOnline'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  try {
    await prisma.$transaction(async (tx) => {
      const activities = await tx.$queryRaw<
        { id: string; status: ActivityStatus }[]
      >(
        Prisma.sql`SELECT id, status FROM activities WHERE id = ${parsed.data.activityId} FOR UPDATE`,
      );
      if (activities.length === 0) throw new Error(te('activityNotFound'));
      const activity = activities[0];

      const membership = await tx.membership.findUnique({
        where: { activityId_userId: { activityId: parsed.data.activityId, userId } },
      });
      const userRole: MemberRole | null = membership?.role ?? null;

      const result = validateTransition(activity.status, 'SCHEDULE', userRole, te);
      if (!result.valid) throw new Error(result.error);

      await tx.activity.update({
        where: { id: parsed.data.activityId },
        data: {
          status: result.to,
          scheduledAt: parsed.data.scheduledAt,
          location: parsed.data.location || null,
          isOnline: parsed.data.isOnline ?? false,
        },
      });

      // Fetch activity title for notification
      const activityData = await tx.activity.findUnique({
        where: { id: parsed.data.activityId },
        select: { title: true },
      });
      const title = activityData?.title ?? 'Activity';
      const dateStr = parsed.data.scheduledAt.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      await notifyActivityMembers(
        parsed.data.activityId,
        'TIME_CONFIRMED',
        te('notificationMeetingScheduled'),
        te('notificationMeetingScheduledMsg', { title, date: dateStr }),
        tx,
        userId,
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : te('failedToSchedule');
    return { errors: { _form: [message] } };
  }

  revalidatePath(ACTIVITIES_PATH);
  return { success: true };
}

/**
 * Start a meeting (SCHEDULED → IN_PROGRESS).
 */
export async function startMeeting(activityId: string): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;
  const te = await getTranslations('serverErrors');

  try {
    await prisma.$transaction(async (tx) => {
      const activities = await tx.$queryRaw<
        { id: string; status: ActivityStatus }[]
      >(
        Prisma.sql`SELECT id, status FROM activities WHERE id = ${activityId} FOR UPDATE`,
      );
      if (activities.length === 0) throw new Error(te('activityNotFound'));
      const activity = activities[0];

      const membership = await tx.membership.findUnique({
        where: { activityId_userId: { activityId, userId } },
      });
      const userRole: MemberRole | null = membership?.role ?? null;

      const result = validateTransition(activity.status, 'START', userRole, te);
      if (!result.valid) throw new Error(result.error);

      await tx.activity.update({
        where: { id: activityId },
        data: { status: result.to },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : te('failedToStart');
    return { errors: { _form: [message] } };
  }

  revalidatePath(ACTIVITIES_PATH);
  return { success: true };
}

/**
 * Complete a meeting (IN_PROGRESS → COMPLETED).
 */
export async function completeMeeting(activityId: string): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;
  const te = await getTranslations('serverErrors');

  try {
    await prisma.$transaction(async (tx) => {
      const activities = await tx.$queryRaw<
        { id: string; status: ActivityStatus }[]
      >(
        Prisma.sql`SELECT id, status FROM activities WHERE id = ${activityId} FOR UPDATE`,
      );
      if (activities.length === 0) throw new Error(te('activityNotFound'));
      const activity = activities[0];

      const membership = await tx.membership.findUnique({
        where: { activityId_userId: { activityId, userId } },
      });
      const userRole: MemberRole | null = membership?.role ?? null;

      const result = validateTransition(activity.status, 'COMPLETE', userRole, te);
      if (!result.valid) throw new Error(result.error);

      await tx.activity.update({
        where: { id: activityId },
        data: { status: result.to },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : te('failedToComplete');
    return { errors: { _form: [message] } };
  }

  revalidatePath(ACTIVITIES_PATH);
  return { success: true };
}

/**
 * Finish an activity — mark the user's membership as personally completed.
 * Only allowed when the instance status is COMPLETED and the user hasn't finished yet.
 */
export async function finishActivity(activityId: string): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;
  const te = await getTranslations('serverErrors');

  try {
    await prisma.$transaction(async (tx) => {
      // Verify instance is COMPLETED
      const activity = await tx.activity.findUnique({
        where: { id: activityId },
        select: { status: true },
      });
      if (!activity) throw new Error(te('activityNotFound'));
      if (activity.status !== 'COMPLETED') {
        throw new Error(te('activityNotCompleted'));
      }

      // Verify caller is a member without completedAt
      const membership = await tx.membership.findUnique({
        where: { activityId_userId: { activityId, userId } },
      });
      if (!membership) throw new Error(te('notMember'));
      if (membership.completedAt) {
        throw new Error(te('alreadyFinished'));
      }

      await tx.membership.update({
        where: { id: membership.id },
        data: { completedAt: new Date() },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : te('failedToFinish');
    return { errors: { _form: [message] } };
  }

  revalidatePath('/dashboard');
  revalidatePath(ACTIVITIES_PATH);
  return { success: true };
}

/**
 * Add a comment to an activity instance.
 * Only members of the instance can post comments.
 */
export async function addActivityComment(
  activityId: string,
  content: string,
): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;
  const te = await getTranslations('serverErrors');

  if (!content.trim()) {
    return { errors: { _form: [te('commentRequired')] } };
  }

  // Verify user is a member of this activity instance
  const membership = await prisma.membership.findUnique({
    where: { activityId_userId: { activityId, userId } },
  });
  if (!membership) {
    return { errors: { _form: [te('notMember')] } };
  }

  await prisma.activityComment.create({
    data: { activityId, userId, content: content.trim() },
  });

  revalidatePath(ACTIVITIES_PATH);
  return { success: true };
}

/**
 * Get comments for an activity instance.
 * Only members of the instance can read comments.
 */
export async function getActivityComments(activityId: string) {
  const session = await requireAuth();
  const userId = session.user.id;

  // Verify user is a member of this activity instance
  const membership = await prisma.membership.findUnique({
    where: { activityId_userId: { activityId, userId } },
  });
  if (!membership) {
    return [];
  }

  return prisma.activityComment.findMany({
    where: { activityId },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { id: true, name: true, username: true } },
    },
  });
}
