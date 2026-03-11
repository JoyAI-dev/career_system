'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';

const ADMIN_PATH = '/admin/recruitment';
const CALENDAR_PATH = '/calendar';

export type ActionState = {
  errors?: { [key: string]: string[] };
  success?: boolean;
};

function getRecruitmentSchema(t: (key: string) => string) {
  return z.object({
    title: z.string().min(1, t('titleRequired')).max(200),
    company: z.string().min(1, t('companyRequired')).max(200),
    description: z.string().max(2000).optional(),
    eventDate: z.coerce.date({ error: t('eventDateRequired') }),
  });
}

export async function createRecruitment(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAdmin();
  const tv = await getTranslations('validation');
  const recruitmentSchema = getRecruitmentSchema(tv);

  const parsed = recruitmentSchema.safeParse({
    title: formData.get('title'),
    company: formData.get('company'),
    description: formData.get('description') || undefined,
    eventDate: formData.get('eventDate'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await prisma.recruitmentInfo.create({
    data: {
      ...parsed.data,
      createdBy: session.user.id,
    },
  });

  revalidatePath(ADMIN_PATH);
  revalidatePath(CALENDAR_PATH);
  return { success: true };
}

export async function updateRecruitment(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const recruitmentSchema = getRecruitmentSchema(tv);

  const id = formData.get('id') as string;
  if (!id) return { errors: { _form: [te('missingId')] } };

  const parsed = recruitmentSchema.safeParse({
    title: formData.get('title'),
    company: formData.get('company'),
    description: formData.get('description') || undefined,
    eventDate: formData.get('eventDate'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await prisma.recruitmentInfo.update({
    where: { id },
    data: parsed.data,
  });

  revalidatePath(ADMIN_PATH);
  revalidatePath(CALENDAR_PATH);
  return { success: true };
}

export async function deleteRecruitment(id: string): Promise<ActionState> {
  await requireAdmin();

  await prisma.recruitmentInfo.delete({ where: { id } });

  revalidatePath(ADMIN_PATH);
  revalidatePath(CALENDAR_PATH);
  return { success: true };
}
