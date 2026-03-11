'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';

const ADMIN_PATH = '/admin/tags';

export type ActionState = {
  errors?: { [key: string]: string[] };
  success?: boolean;
};

function getCreateTagSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t('nameRequired')).max(50),
  });
}

function getUpdateTagSchema(t: (key: string) => string) {
  return z.object({
    id: z.string().min(1),
    name: z.string().min(1, t('nameRequired')).max(50),
  });
}

export async function createTag(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const createTagSchema = getCreateTagSchema(tv);

  const parsed = createTagSchema.safeParse({
    name: formData.get('name'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const existing = await prisma.tag.findUnique({ where: { name: parsed.data.name } });
  if (existing) {
    return { errors: { name: [te('tagNameExists')] } };
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
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const updateTagSchema = getUpdateTagSchema(tv);

  const parsed = updateTagSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const existing = await prisma.tag.findFirst({
    where: { name: parsed.data.name, NOT: { id: parsed.data.id } },
  });
  if (existing) {
    return { errors: { name: [te('tagNameExists')] } };
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
  const te = await getTranslations('serverErrors');

  const count = await prisma.activityTag.count({ where: { tagId: id } });
  if (count > 0) {
    return { errors: { _form: [te('cannotDeleteTagInUse', { count })] } };
  }

  await prisma.tag.delete({ where: { id } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}
