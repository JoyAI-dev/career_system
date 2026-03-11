'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

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
