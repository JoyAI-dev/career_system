'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export type ActionState = {
  errors?: { [key: string]: string[] };
  success?: boolean;
};

const addCommentSchema = z.object({
  responseAnswerId: z.string().min(1, 'Answer ID is required'),
  content: z.string().min(1, 'Comment is required').max(1000),
  activityTag: z.string().max(100).optional(),
});

// Actor model: Self-reflection only. Users can only comment on their own
// questionnaire answers as part of their cognitive growth journaling.
// The ownership guard (line 38) enforces this invariant, so cross-user
// NEW_COMMENT notifications are not applicable in this model.
// If cross-user comments are needed in the future, remove the ownership
// guard and add scoped authorization (e.g., same-activity membership).
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

  // Verify the response answer belongs to the current user (self-reflection model)
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

  revalidatePath('/cognitive-report');
  return { success: true };
}
