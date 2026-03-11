'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { createNotification } from '@/server/notifications';

export type ActionState = {
  errors?: { [key: string]: string[] };
  success?: boolean;
};

const addCommentSchema = z.object({
  responseAnswerId: z.string().min(1, 'Answer ID is required'),
  content: z.string().min(1, 'Comment is required').max(1000),
  activityTag: z.string().max(100).optional(),
});

export async function addComment(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAuth();

  const parsed = addCommentSchema.safeParse({
    responseAnswerId: formData.get('responseAnswerId'),
    content: formData.get('content'),
    activityTag: formData.get('activityTag') || undefined,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  // Verify the response answer belongs to the current user
  const answer = await prisma.responseAnswer.findUnique({
    where: { id: parsed.data.responseAnswerId },
    select: { snapshot: { select: { userId: true } } },
  });
  if (!answer || answer.snapshot.userId !== session.user.id) {
    return { errors: { _form: ['You can only comment on your own answers.'] } };
  }

  await prisma.responseComment.create({
    data: {
      responseAnswerId: parsed.data.responseAnswerId,
      userId: session.user.id,
      content: parsed.data.content,
      activityTag: parsed.data.activityTag ?? null,
    },
  });

  // Notify answer owner if commenter is different (future-proofing for shared comments)
  const ownerId = answer.snapshot.userId;
  if (ownerId !== session.user.id) {
    await createNotification({
      userId: ownerId,
      type: 'NEW_COMMENT',
      title: 'New Comment',
      message: `Someone commented on your questionnaire answer.`,
    });
  }

  revalidatePath('/cognitive-report');
  return { success: true };
}
