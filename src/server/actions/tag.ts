'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const ADMIN_PATH = '/admin/tags';

export type ActionState = {
  errors?: { [key: string]: string[] };
  success?: boolean;
};

const createTagSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
});

const updateTagSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(50),
});

export async function createTag(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = createTagSchema.safeParse({
    name: formData.get('name'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const existing = await prisma.tag.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { errors: { name: ['A tag with this name already exists.'] } };
  }

  await prisma.tag.create({ data: { name: parsed.data.name } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function updateTag(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = updateTagSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const existing = await prisma.tag.findFirst({
    where: { name: parsed.data.name, NOT: { id: parsed.data.id } },
  });
  if (existing) {
    return { errors: { name: ['A tag with this name already exists.'] } };
  }

  await prisma.tag.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteTag(id: string): Promise<ActionState> {
  await requireAdmin();

  const count = await prisma.activityTag.count({ where: { tagId: id } });
  if (count > 0) {
    return { errors: { _form: [`Cannot delete: tag is used by ${count} activities.`] } };
  }

  await prisma.tag.delete({ where: { id } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}
