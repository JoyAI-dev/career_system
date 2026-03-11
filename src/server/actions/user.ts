'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const updateProfileSchema = z.object({
  name: z.string().max(100, 'Name must be at most 100 characters').optional().or(z.literal('')),
  school: z.string().max(100, 'School must be at most 100 characters').optional().or(z.literal('')),
  major: z.string().max(100, 'Major must be at most 100 characters').optional().or(z.literal('')),
  grade: z.string().optional().or(z.literal('')),
});

export type UpdateProfileState = {
  errors?: {
    name?: string[];
    school?: string[];
    major?: string[];
    grade?: string[];
    _form?: string[];
  };
  success?: boolean;
};

export async function updateProfile(
  _prevState: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const session = await requireAuth();

  const parsed = updateProfileSchema.safeParse({
    name: formData.get('name'),
    school: formData.get('school'),
    major: formData.get('major'),
    grade: formData.get('grade'),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const { name, school, major, grade } = parsed.data;

  // Validate grade against active grade options
  if (grade) {
    const validOption = await prisma.gradeOption.findFirst({
      where: { label: grade, isActive: true },
    });
    if (!validOption) {
      return { errors: { grade: ['Invalid grade option'] } };
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: name || null,
      school: school || null,
      major: major || null,
      grade: grade || null,
    },
  });

  revalidatePath('/profile');

  return { success: true };
}
