'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const addReflectionSchema = z.object({
  questionId: z.string().min(1),
  content: z.string().min(1).max(2000),
  activityTag: z.string().max(100).optional(),
});

export async function addReflection(
  questionId: string,
  content: string,
  activityTag?: string,
) {
  const session = await requireAuth();

  const parsed = addReflectionSchema.safeParse({ questionId, content, activityTag });
  if (!parsed.success) {
    return { error: 'Invalid input' };
  }

  await prisma.reflection.create({
    data: {
      userId: session.user.id,
      questionId: parsed.data.questionId,
      content: parsed.data.content,
      activityTag: parsed.data.activityTag ?? null,
    },
  });

  revalidatePath('/cognitive-report');
  return { success: true };
}

export async function getReflections(questionId: string) {
  const session = await requireAuth();

  const reflections = await prisma.reflection.findMany({
    where: {
      questionId,
      userId: session.user.id,
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      content: true,
      activityTag: true,
      createdAt: true,
    },
  });

  return reflections.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
  }));
}
