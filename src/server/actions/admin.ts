'use server';

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin, auth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';

// --- Grade Options ---

function getGradeOptionSchema(t: (key: string) => string) {
  return z.object({
    label: z
      .string()
      .min(1, t('labelRequired'))
      .max(50, t('labelMax')),
    order: z.coerce.number().int().min(0, t('orderMin')),
    isActive: z.coerce.boolean().default(true),
  });
}

export type GradeOptionState = {
  errors?: {
    label?: string[];
    order?: string[];
    isActive?: string[];
    _form?: string[];
  };
  success?: boolean;
};

export async function createGradeOption(
  _prevState: GradeOptionState,
  formData: FormData,
): Promise<GradeOptionState> {
  await requireAdmin();
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const gradeOptionSchema = getGradeOptionSchema(tv);

  const parsed = gradeOptionSchema.safeParse({
    label: formData.get('label'),
    order: formData.get('order'),
    isActive: formData.get('isActive') === 'true',
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { label, order, isActive } = parsed.data;

  const existing = await prisma.gradeOption.findUnique({ where: { label } });
  if (existing) {
    return { errors: { label: [te('labelAlreadyExists')] } };
  }

  try {
    await prisma.gradeOption.create({
      data: { label, order, isActive },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { errors: { label: [te('labelAlreadyExists')] } };
    }
    throw error;
  }

  revalidatePath('/admin/grades');
  return { success: true };
}

export async function updateGradeOption(
  _prevState: GradeOptionState,
  formData: FormData,
): Promise<GradeOptionState> {
  await requireAdmin();
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const gradeOptionSchema = getGradeOptionSchema(tv);

  const id = formData.get('id') as string;
  if (!id) {
    return { errors: { _form: [te('gradeOptionIdRequired')] } };
  }

  const parsed = gradeOptionSchema.safeParse({
    label: formData.get('label'),
    order: formData.get('order'),
    isActive: formData.get('isActive') === 'true',
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { label, order, isActive } = parsed.data;

  // Check for duplicate label (excluding current)
  const existing = await prisma.gradeOption.findUnique({ where: { label } });
  if (existing && existing.id !== id) {
    return { errors: { label: [te('labelAlreadyExists')] } };
  }

  try {
    await prisma.gradeOption.update({
      where: { id },
      data: { label, order, isActive },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return { errors: { label: [te('labelAlreadyExists')] } };
    }
    throw error;
  }

  revalidatePath('/admin/grades');
  return { success: true };
}

export async function deleteGradeOption(id: string): Promise<{ error?: string }> {
  await requireAdmin();

  await prisma.gradeOption.delete({ where: { id } });

  revalidatePath('/admin/grades');
  return {};
}

export async function reorderGradeOption(
  id: string,
  direction: 'up' | 'down',
): Promise<void> {
  await requireAdmin();

  const options = await prisma.gradeOption.findMany({
    orderBy: { order: 'asc' },
  });

  const index = options.findIndex((o) => o.id === id);
  if (index === -1) return;

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= options.length) return;

  const current = options[index];
  const swap = options[swapIndex];

  await prisma.$transaction([
    prisma.gradeOption.update({
      where: { id: current.id },
      data: { order: swap.order },
    }),
    prisma.gradeOption.update({
      where: { id: swap.id },
      data: { order: current.order },
    }),
  ]);

  revalidatePath('/admin/grades');
}

// --- System Settings ---

export async function getSystemSetting(key: string): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function updateSystemSetting(
  key: string,
  value: string,
): Promise<void> {
  await requireAdmin();

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });

  revalidatePath('/admin/settings');
}

// --- User Role Management ---

export async function changeUserRole(
  userId: string,
  newRole: 'USER' | 'ADMIN',
): Promise<{ success?: boolean; error?: string }> {
  await requireAdmin();
  const session = await auth();
  const adminId = session!.user.id;
  const te = await getTranslations('serverErrors');

  if (adminId === userId) {
    return { error: te('cannotChangeOwnRole') };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, username: true },
  });
  if (!user) return { error: te('userNotFound') };

  const oldRole = user.role;
  if (oldRole === newRole) return { error: te('userAlreadyRole', { role: newRole }) };

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
    }),
    (prisma as any).auditLog.create({
      data: {
        adminId,
        action: 'ROLE_CHANGE',
        targetId: userId,
        details: JSON.stringify({
          username: user.username,
          from: oldRole,
          to: newRole,
        }),
      },
    }),
  ]);

  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  return { success: true };
}
