'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';

const ADMIN_PATH = '/admin/activity-types';

export type ActionState = {
  errors?: { [key: string]: string[] };
  success?: boolean;
};

function getCreateActivityTypeSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('nameRequired')).max(100),
    defaultCapacity: z.coerce.number().int().min(1, t('capacityMinOne')).max(1000),
    prerequisiteTypeId: z.string().optional().transform((v) => v || null),
  });
}

function getUpdateActivityTypeSchema(t: (key: string) => string) {
  return z.object({
    id: z.string().min(1),
    name: z.string().min(1, t('nameRequired')).max(100),
    defaultCapacity: z.coerce.number().int().min(1, t('capacityMinOne')).max(1000),
    prerequisiteTypeId: z.string().optional().transform((v) => v || null),
  });
}

export async function createActivityType(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const tv = await getTranslations('validation');
  const createActivityTypeSchema = getCreateActivityTypeSchema(tv);

  const parsed = createActivityTypeSchema.safeParse({
    name: formData.get('name'),
    defaultCapacity: formData.get('defaultCapacity'),
    prerequisiteTypeId: formData.get('prerequisiteTypeId'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // Prevent circular prerequisite (self-reference checked at update level)
  const maxOrder = await prisma.activityType.aggregate({
    _max: { order: true },
  });

  await prisma.activityType.create({
    data: {
      name: parsed.data.name,
      defaultCapacity: parsed.data.defaultCapacity,
      prerequisiteTypeId: parsed.data.prerequisiteTypeId,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function updateActivityType(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const updateActivityTypeSchema = getUpdateActivityTypeSchema(tv);

  const parsed = updateActivityTypeSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    defaultCapacity: formData.get('defaultCapacity'),
    prerequisiteTypeId: formData.get('prerequisiteTypeId'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // Prevent self-reference
  if (parsed.data.prerequisiteTypeId === parsed.data.id) {
    return { errors: { prerequisiteTypeId: [te('cannotSelfPrerequisite')] } };
  }

  await prisma.activityType.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      defaultCapacity: parsed.data.defaultCapacity,
      prerequisiteTypeId: parsed.data.prerequisiteTypeId,
    },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteActivityType(id: string): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  // Check if any activities use this type
  const count = await prisma.activity.count({ where: { typeId: id } });
  if (count > 0) {
    return { errors: { _form: [te('cannotDeleteTypeInUse', { count })] } };
  }

  // Clear prerequisite references pointing to this type
  await prisma.activityType.updateMany({
    where: { prerequisiteTypeId: id },
    data: { prerequisiteTypeId: null },
  });

  await prisma.activityType.delete({ where: { id } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function reorderActivityType(
  id: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const type = await prisma.activityType.findUnique({ where: { id } });
  if (!type) return { errors: { _form: [te('activityTypeNotFound')] } };

  const sibling = await prisma.activityType.findFirst({
    where: {
      order: direction === 'up' ? { lt: type.order } : { gt: type.order },
    },
    orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
  });

  if (!sibling) return { success: true };

  await prisma.$transaction([
    prisma.activityType.update({ where: { id: type.id }, data: { order: sibling.order } }),
    prisma.activityType.update({ where: { id: sibling.id }, data: { order: type.order } }),
  ]);

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function toggleActivityType(id: string): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const type = await prisma.activityType.findUnique({
    where: { id },
    select: { isEnabled: true },
  });
  if (!type) return { errors: { _form: [te('activityTypeNotFound')] } };

  await prisma.activityType.update({
    where: { id },
    data: { isEnabled: !type.isEnabled },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}
