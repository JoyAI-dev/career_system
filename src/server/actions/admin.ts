'use server';

import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// --- Grade Options ---

const gradeOptionSchema = z.object({
  label: z
    .string()
    .min(1, 'Label is required')
    .max(50, 'Label must be at most 50 characters'),
  order: z.coerce.number().int().min(0, 'Order must be non-negative'),
  isActive: z.coerce.boolean().default(true),
});

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
    return { errors: { label: ['This label already exists'] } };
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
      return { errors: { label: ['This label already exists'] } };
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

  const id = formData.get('id') as string;
  if (!id) {
    return { errors: { _form: ['Grade option ID is required'] } };
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
    return { errors: { label: ['This label already exists'] } };
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
      return { errors: { label: ['This label already exists'] } };
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
