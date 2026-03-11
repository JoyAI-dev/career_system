'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, requireAuth, auth } from '@/lib/auth';
import { getUnlockedTypeIds } from '@/server/queries/activity';
import { validateTransition, type TransitionAction } from '@/server/stateMachine';
import { revalidatePath } from 'next/cache';
import { notifyActivityMembers } from '@/server/notifications';
import type { ActivityStatus, MemberRole } from '@prisma/client';

const ADMIN_PATH = '/admin/activities';

export type ActionState = {
  errors?: { [key: string]: string[] };
  success?: boolean;
};

const createActivitySchema = z.object({
  typeId: z.string().min(1, 'Activity type is required'),
  title: z.string().min(1, 'Title is required').max(200),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1'),
  guideMarkdown: z.string().optional(),
  location: z.string().optional(),
  isOnline: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  tagIds: z.array(z.string()).optional(),
});

const updateActivitySchema = z.object({
  id: z.string().min(1),
  typeId: z.string().min(1, 'Activity type is required'),
  title: z.string().min(1, 'Title is required').max(200),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1'),
  guideMarkdown: z.string().optional(),
  location: z.string().optional(),
  isOnline: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  tagIds: z.array(z.string()).optional(),
});

export async function createActivity(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const session = await auth();

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
    return { errors: { typeId: ['Invalid or disabled activity type.'] } };
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
    return { errors: { _form: ['Activity not found.'] } };
  }
  if (existing.status !== 'OPEN') {
    return { errors: { _form: ['Can only edit activities with OPEN status.'] } };
  }
  if (parsed.data.capacity < existing._count.memberships) {
    return {
      errors: {
        capacity: [`Capacity cannot be less than current member count (${existing._count.memberships}).`],
      },
    };
  }

  const type = await prisma.activityType.findUnique({ where: { id: parsed.data.typeId } });
  if (!type || !type.isEnabled) {
    return { errors: { typeId: ['Invalid or disabled activity type.'] } };
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

  const existing = await prisma.activity.findUnique({
    where: { id },
    include: { _count: { select: { memberships: true } } },
  });
  if (!existing) {
    return { errors: { _form: ['Activity not found.'] } };
  }
  if (existing._count.memberships > 0) {
    return {
      errors: { _form: [`Cannot delete: activity has ${existing._count.memberships} members.`] },
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

  try {
    await prisma.$transaction(async (tx) => {
      // Lock the activity row for update to prevent concurrent joins exceeding capacity
      const activities = await tx.$queryRawUnsafe<
        { id: string; typeId: string; capacity: number; status: string }[]
      >(
        'SELECT id, "typeId", capacity, status FROM activities WHERE id = $1 FOR UPDATE',
        activityId,
      );

      if (activities.length === 0) {
        throw new Error('Activity not found.');
      }
      const activity = activities[0];

      if (activity.status !== 'OPEN') {
        throw new Error('Activity is not open for joining.');
      }

      // Check progressive unlock
      const unlockedTypeIds = await getUnlockedTypeIds(userId);
      if (!unlockedTypeIds.has(activity.typeId)) {
        throw new Error('You have not completed the prerequisite activity type.');
      }

      // Check if already a member (unique constraint backup)
      const existingMembership = await tx.membership.findUnique({
        where: { activityId_userId: { activityId, userId } },
      });
      if (existingMembership) {
        throw new Error('You have already joined this activity.');
      }

      // Count current members (within the lock scope)
      const memberCount = await tx.membership.count({ where: { activityId } });
      if (memberCount >= activity.capacity) {
        throw new Error('Activity is full.');
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
          'Activity Full',
          `"${title}" has reached full capacity. The leader can now schedule a meeting.`,
          tx,
        );
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to join activity.';
    return { errors: { _form: [message] } };
  }

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

  try {
    await prisma.$transaction(async (tx) => {
      // Lock activity row
      const activities = await tx.$queryRawUnsafe<
        { id: string; capacity: number; status: string }[]
      >(
        'SELECT id, capacity, status FROM activities WHERE id = $1 FOR UPDATE',
        activityId,
      );

      if (activities.length === 0) {
        throw new Error('Activity not found.');
      }
      const activity = activities[0];

      const membership = await tx.membership.findUnique({
        where: { activityId_userId: { activityId, userId } },
      });
      if (!membership) {
        throw new Error('You are not a member of this activity.');
      }

      // Leader cannot leave if there are other members
      if (membership.role === 'LEADER') {
        const memberCount = await tx.membership.count({ where: { activityId } });
        if (memberCount > 1) {
          throw new Error('Leader cannot leave while other members remain. Transfer leadership first.');
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
    const message = error instanceof Error ? error.message : 'Failed to leave activity.';
    return { errors: { _form: [message] } };
  }

  revalidatePath(ACTIVITIES_PATH);
  return { success: true };
}

const scheduleSchema = z.object({
  activityId: z.string().min(1),
  scheduledAt: z.coerce.date({ error: 'Meeting date/time is required' }),
  location: z.string().optional(),
  isOnline: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
});

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

  const parsed = scheduleSchema.safeParse({
    activityId: formData.get('activityId'),
    scheduledAt: formData.get('scheduledAt'),
    location: formData.get('location') || undefined,
    isOnline: formData.get('isOnline'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  try {
    await prisma.$transaction(async (tx) => {
      const activities = await tx.$queryRawUnsafe<
        { id: string; status: ActivityStatus }[]
      >(
        'SELECT id, status FROM activities WHERE id = $1 FOR UPDATE',
        parsed.data.activityId,
      );
      if (activities.length === 0) throw new Error('Activity not found.');
      const activity = activities[0];

      const membership = await tx.membership.findUnique({
        where: { activityId_userId: { activityId: parsed.data.activityId, userId } },
      });
      const userRole: MemberRole | null = membership?.role ?? null;

      const result = validateTransition(activity.status, 'SCHEDULE', userRole);
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
      const dateStr = parsed.data.scheduledAt.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      await notifyActivityMembers(
        parsed.data.activityId,
        'TIME_CONFIRMED',
        'Meeting Scheduled',
        `"${title}" has been scheduled for ${dateStr}.`,
        tx,
        userId,
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to schedule meeting.';
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

  try {
    await prisma.$transaction(async (tx) => {
      const activities = await tx.$queryRawUnsafe<
        { id: string; status: ActivityStatus }[]
      >(
        'SELECT id, status FROM activities WHERE id = $1 FOR UPDATE',
        activityId,
      );
      if (activities.length === 0) throw new Error('Activity not found.');
      const activity = activities[0];

      const membership = await tx.membership.findUnique({
        where: { activityId_userId: { activityId, userId } },
      });
      const userRole: MemberRole | null = membership?.role ?? null;

      const result = validateTransition(activity.status, 'START', userRole);
      if (!result.valid) throw new Error(result.error);

      await tx.activity.update({
        where: { id: activityId },
        data: { status: result.to },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start meeting.';
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

  try {
    await prisma.$transaction(async (tx) => {
      const activities = await tx.$queryRawUnsafe<
        { id: string; status: ActivityStatus }[]
      >(
        'SELECT id, status FROM activities WHERE id = $1 FOR UPDATE',
        activityId,
      );
      if (activities.length === 0) throw new Error('Activity not found.');
      const activity = activities[0];

      const membership = await tx.membership.findUnique({
        where: { activityId_userId: { activityId, userId } },
      });
      const userRole: MemberRole | null = membership?.role ?? null;

      const result = validateTransition(activity.status, 'COMPLETE', userRole);
      if (!result.valid) throw new Error(result.error);

      await tx.activity.update({
        where: { id: activityId },
        data: { status: result.to },
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete meeting.';
    return { errors: { _form: [message] } };
  }

  revalidatePath(ACTIVITIES_PATH);
  return { success: true };
}
