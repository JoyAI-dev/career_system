'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const ADMIN_PATH = '/admin/questionnaire';

// ─── Zod Schemas ────────────────────────────────────────────────────

const createTopicSchema = z.object({
  versionId: z.string().min(1, 'Version is required'),
  name: z.string().min(1, 'Name is required').max(200),
});

const updateTopicSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(200),
});

const createDimensionSchema = z.object({
  topicId: z.string().min(1, 'Topic is required'),
  name: z.string().min(1, 'Name is required').max(200),
});

const updateDimensionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Name is required').max(200),
});

const createQuestionSchema = z.object({
  dimensionId: z.string().min(1, 'Dimension is required'),
  title: z.string().min(1, 'Title is required').max(500),
});

const updateQuestionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, 'Title is required').max(500),
});

const createNoteSchema = z.object({
  questionId: z.string().min(1, 'Question is required'),
  label: z.string().min(1, 'Label is required').max(100),
  content: z.string().min(1, 'Content is required').max(2000),
});

const updateNoteSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, 'Label is required').max(100),
  content: z.string().min(1, 'Content is required').max(2000),
});

// ─── State Types ────────────────────────────────────────────────────

export type ActionState = {
  errors?: { [key: string]: string[] };
  success?: boolean;
};

// ─── Helper: Verify version is a draft (not active) ────────────────

async function requireDraftVersion(versionId: string) {
  const version = await prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    select: { isActive: true },
  });
  if (!version) throw new Error('Version not found');
  if (version.isActive) throw new Error('Cannot modify an active (published) version');
  return version;
}

async function getVersionIdFromTopic(topicId: string) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { versionId: true },
  });
  if (!topic) throw new Error('Topic not found');
  return topic.versionId;
}

async function getVersionIdFromDimension(dimensionId: string) {
  const dimension = await prisma.dimension.findUnique({
    where: { id: dimensionId },
    include: { topic: { select: { versionId: true } } },
  });
  if (!dimension) throw new Error('Dimension not found');
  return dimension.topic.versionId;
}

async function getVersionIdFromQuestion(questionId: string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      dimension: {
        include: { topic: { select: { versionId: true } } },
      },
    },
  });
  if (!question) throw new Error('Question not found');
  return question.dimension.topic.versionId;
}

// ─── Version Management ─────────────────────────────────────────────

export async function createDraftVersion(): Promise<ActionState> {
  await requireAdmin();

  const existing = await prisma.questionnaireVersion.findFirst({
    where: { isActive: false },
    select: { id: true },
  });
  if (existing) {
    return { errors: { _form: ['A draft version already exists. Publish or delete it first.'] } };
  }

  const active = await prisma.questionnaireVersion.findFirst({
    where: { isActive: true },
    include: {
      topics: {
        orderBy: { order: 'asc' },
        include: {
          dimensions: {
            orderBy: { order: 'asc' },
            include: {
              questions: {
                orderBy: { order: 'asc' },
                include: {
                  notes: true,
                  answerOptions: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const maxVersion = await prisma.questionnaireVersion.findFirst({
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const nextVersion = (maxVersion?.version ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    const newVersion = await tx.questionnaireVersion.create({
      data: {
        version: nextVersion,
        isActive: false,
      },
    });

    if (active) {
      for (const topic of active.topics) {
        const newTopic = await tx.topic.create({
          data: {
            versionId: newVersion.id,
            name: topic.name,
            order: topic.order,
          },
        });
        for (const dim of topic.dimensions) {
          const newDim = await tx.dimension.create({
            data: {
              topicId: newTopic.id,
              name: dim.name,
              order: dim.order,
            },
          });
          for (const q of dim.questions) {
            const newQ = await tx.question.create({
              data: {
                dimensionId: newDim.id,
                title: q.title,
                order: q.order,
              },
            });
            for (const note of q.notes) {
              await tx.questionNote.create({
                data: {
                  questionId: newQ.id,
                  label: note.label,
                  content: note.content,
                },
              });
            }
            for (const opt of q.answerOptions) {
              await tx.answerOption.create({
                data: {
                  questionId: newQ.id,
                  label: opt.label,
                  score: opt.score,
                  order: opt.order,
                },
              });
            }
          }
        }
      }
    }
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function publishVersion(versionId: string): Promise<ActionState> {
  await requireAdmin();

  const version = await prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    select: { isActive: true },
  });
  if (!version) return { errors: { _form: ['Version not found'] } };
  if (version.isActive) return { errors: { _form: ['Version is already active'] } };

  await prisma.$transaction([
    prisma.questionnaireVersion.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    }),
    prisma.questionnaireVersion.update({
      where: { id: versionId },
      data: { isActive: true },
    }),
  ]);

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function setActiveVersion(versionId: string): Promise<ActionState> {
  await requireAdmin();

  const version = await prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    select: { id: true },
  });
  if (!version) return { errors: { _form: ['Version not found'] } };

  await prisma.$transaction([
    prisma.questionnaireVersion.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    }),
    prisma.questionnaireVersion.update({
      where: { id: versionId },
      data: { isActive: true },
    }),
  ]);

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteDraftVersion(versionId: string): Promise<ActionState> {
  await requireAdmin();

  const version = await prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    select: { isActive: true },
  });
  if (!version) return { errors: { _form: ['Version not found'] } };
  if (version.isActive) return { errors: { _form: ['Cannot delete the active version'] } };

  await prisma.questionnaireVersion.delete({ where: { id: versionId } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

// ─── Topic CRUD ─────────────────────────────────────────────────────

export async function createTopic(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = createTopicSchema.safeParse({
    versionId: formData.get('versionId'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await requireDraftVersion(parsed.data.versionId);

  const maxOrder = await prisma.topic.aggregate({
    where: { versionId: parsed.data.versionId },
    _max: { order: true },
  });

  await prisma.topic.create({
    data: {
      versionId: parsed.data.versionId,
      name: parsed.data.name,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function updateTopic(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = updateTopicSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromTopic(parsed.data.id);
  await requireDraftVersion(versionId);

  await prisma.topic.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteTopic(topicId: string): Promise<ActionState> {
  await requireAdmin();

  const versionId = await getVersionIdFromTopic(topicId);
  await requireDraftVersion(versionId);

  await prisma.topic.delete({ where: { id: topicId } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function reorderTopic(
  topicId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  await requireAdmin();

  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) return { errors: { _form: ['Topic not found'] } };

  await requireDraftVersion(topic.versionId);

  const sibling = await prisma.topic.findFirst({
    where: {
      versionId: topic.versionId,
      order: direction === 'up' ? { lt: topic.order } : { gt: topic.order },
    },
    orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
  });

  if (!sibling) return { success: true };

  await prisma.$transaction([
    prisma.topic.update({ where: { id: topic.id }, data: { order: sibling.order } }),
    prisma.topic.update({ where: { id: sibling.id }, data: { order: topic.order } }),
  ]);

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

// ─── Dimension CRUD ─────────────────────────────────────────────────

export async function createDimension(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = createDimensionSchema.safeParse({
    topicId: formData.get('topicId'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromTopic(parsed.data.topicId);
  await requireDraftVersion(versionId);

  const maxOrder = await prisma.dimension.aggregate({
    where: { topicId: parsed.data.topicId },
    _max: { order: true },
  });

  await prisma.dimension.create({
    data: {
      topicId: parsed.data.topicId,
      name: parsed.data.name,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function updateDimension(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = updateDimensionSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromDimension(parsed.data.id);
  await requireDraftVersion(versionId);

  await prisma.dimension.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteDimension(dimensionId: string): Promise<ActionState> {
  await requireAdmin();

  const versionId = await getVersionIdFromDimension(dimensionId);
  await requireDraftVersion(versionId);

  await prisma.dimension.delete({ where: { id: dimensionId } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function reorderDimension(
  dimensionId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  await requireAdmin();

  const dim = await prisma.dimension.findUnique({ where: { id: dimensionId } });
  if (!dim) return { errors: { _form: ['Dimension not found'] } };

  const versionId = await getVersionIdFromTopic(dim.topicId);
  await requireDraftVersion(versionId);

  const sibling = await prisma.dimension.findFirst({
    where: {
      topicId: dim.topicId,
      order: direction === 'up' ? { lt: dim.order } : { gt: dim.order },
    },
    orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
  });

  if (!sibling) return { success: true };

  await prisma.$transaction([
    prisma.dimension.update({ where: { id: dim.id }, data: { order: sibling.order } }),
    prisma.dimension.update({ where: { id: sibling.id }, data: { order: dim.order } }),
  ]);

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

// ─── Question CRUD ──────────────────────────────────────────────────

export async function createQuestion(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = createQuestionSchema.safeParse({
    dimensionId: formData.get('dimensionId'),
    title: formData.get('title'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromDimension(parsed.data.dimensionId);
  await requireDraftVersion(versionId);

  const maxOrder = await prisma.question.aggregate({
    where: { dimensionId: parsed.data.dimensionId },
    _max: { order: true },
  });

  await prisma.question.create({
    data: {
      dimensionId: parsed.data.dimensionId,
      title: parsed.data.title,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function updateQuestion(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = updateQuestionSchema.safeParse({
    id: formData.get('id'),
    title: formData.get('title'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromQuestion(parsed.data.id);
  await requireDraftVersion(versionId);

  await prisma.question.update({
    where: { id: parsed.data.id },
    data: { title: parsed.data.title },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteQuestion(questionId: string): Promise<ActionState> {
  await requireAdmin();

  const versionId = await getVersionIdFromQuestion(questionId);
  await requireDraftVersion(versionId);

  await prisma.question.delete({ where: { id: questionId } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function reorderQuestion(
  questionId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  await requireAdmin();

  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) return { errors: { _form: ['Question not found'] } };

  const versionId = await getVersionIdFromDimension(q.dimensionId);
  await requireDraftVersion(versionId);

  const sibling = await prisma.question.findFirst({
    where: {
      dimensionId: q.dimensionId,
      order: direction === 'up' ? { lt: q.order } : { gt: q.order },
    },
    orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
  });

  if (!sibling) return { success: true };

  await prisma.$transaction([
    prisma.question.update({ where: { id: q.id }, data: { order: sibling.order } }),
    prisma.question.update({ where: { id: sibling.id }, data: { order: q.order } }),
  ]);

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

// ─── Question Note CRUD ─────────────────────────────────────────────

export async function createQuestionNote(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = createNoteSchema.safeParse({
    questionId: formData.get('questionId'),
    label: formData.get('label'),
    content: formData.get('content'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromQuestion(parsed.data.questionId);
  await requireDraftVersion(versionId);

  await prisma.questionNote.create({
    data: {
      questionId: parsed.data.questionId,
      label: parsed.data.label,
      content: parsed.data.content,
    },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function updateQuestionNote(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = updateNoteSchema.safeParse({
    id: formData.get('id'),
    label: formData.get('label'),
    content: formData.get('content'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const note = await prisma.questionNote.findUnique({
    where: { id: parsed.data.id },
    select: { questionId: true },
  });
  if (!note) return { errors: { _form: ['Note not found'] } };

  const versionId = await getVersionIdFromQuestion(note.questionId);
  await requireDraftVersion(versionId);

  await prisma.questionNote.update({
    where: { id: parsed.data.id },
    data: { label: parsed.data.label, content: parsed.data.content },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteQuestionNote(noteId: string): Promise<ActionState> {
  await requireAdmin();

  const note = await prisma.questionNote.findUnique({
    where: { id: noteId },
    select: { questionId: true },
  });
  if (!note) return { errors: { _form: ['Note not found'] } };

  const versionId = await getVersionIdFromQuestion(note.questionId);
  await requireDraftVersion(versionId);

  await prisma.questionNote.delete({ where: { id: noteId } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

// ─── Answer Option CRUD ─────────────────────────────────────────────

const answerOptionSchema = z.object({
  label: z.string().min(1, 'Label is required').max(200),
  score: z.coerce.number().int().min(0, 'Score must be 0 or more').max(100, 'Score must be 100 or less'),
});

const createAnswerOptionSchema = answerOptionSchema.extend({
  questionId: z.string().min(1, 'Question is required'),
});

const updateAnswerOptionSchema = answerOptionSchema.extend({
  id: z.string().min(1),
});

export async function createAnswerOption(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = createAnswerOptionSchema.safeParse({
    questionId: formData.get('questionId'),
    label: formData.get('label'),
    score: formData.get('score'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromQuestion(parsed.data.questionId);
  await requireDraftVersion(versionId);

  const maxOrder = await prisma.answerOption.aggregate({
    where: { questionId: parsed.data.questionId },
    _max: { order: true },
  });

  await prisma.answerOption.create({
    data: {
      questionId: parsed.data.questionId,
      label: parsed.data.label,
      score: parsed.data.score,
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function updateAnswerOption(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const parsed = updateAnswerOptionSchema.safeParse({
    id: formData.get('id'),
    label: formData.get('label'),
    score: formData.get('score'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const option = await prisma.answerOption.findUnique({
    where: { id: parsed.data.id },
    select: { questionId: true },
  });
  if (!option) return { errors: { _form: ['Option not found'] } };

  const versionId = await getVersionIdFromQuestion(option.questionId);
  await requireDraftVersion(versionId);

  await prisma.answerOption.update({
    where: { id: parsed.data.id },
    data: { label: parsed.data.label, score: parsed.data.score },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteAnswerOption(optionId: string): Promise<ActionState> {
  await requireAdmin();

  const option = await prisma.answerOption.findUnique({
    where: { id: optionId },
    select: { questionId: true },
  });
  if (!option) return { errors: { _form: ['Option not found'] } };

  const versionId = await getVersionIdFromQuestion(option.questionId);
  await requireDraftVersion(versionId);

  await prisma.answerOption.delete({ where: { id: optionId } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function reorderAnswerOption(
  optionId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  await requireAdmin();

  const option = await prisma.answerOption.findUnique({ where: { id: optionId } });
  if (!option) return { errors: { _form: ['Option not found'] } };

  const versionId = await getVersionIdFromQuestion(option.questionId);
  await requireDraftVersion(versionId);

  const sibling = await prisma.answerOption.findFirst({
    where: {
      questionId: option.questionId,
      order: direction === 'up' ? { lt: option.order } : { gt: option.order },
    },
    orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
  });

  if (!sibling) return { success: true };

  await prisma.$transaction([
    prisma.answerOption.update({ where: { id: option.id }, data: { order: sibling.order } }),
    prisma.answerOption.update({ where: { id: sibling.id }, data: { order: option.order } }),
  ]);

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

// ─── User Questionnaire Submission ───────────────────────────────────

const submitQuestionnaireSchema = z.object({
  versionId: z.string().min(1),
  answers: z.record(z.string(), z.string()).refine(
    (val) => Object.keys(val).length > 0,
    'At least one answer is required',
  ),
});

export async function submitQuestionnaire(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;

  const rawAnswers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('answer_') && typeof value === 'string') {
      const questionId = key.replace('answer_', '');
      rawAnswers[questionId] = value;
    }
  }

  const parsed = submitQuestionnaireSchema.safeParse({
    versionId: formData.get('versionId'),
    answers: rawAnswers,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { versionId, answers } = parsed.data;

  // Verify the version is active
  const version = await prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    select: { isActive: true },
  });
  if (!version?.isActive) {
    return { errors: { _form: ['This questionnaire version is no longer active.'] } };
  }

  // Get all questions for this version to validate completeness
  const allQuestions = await prisma.question.findMany({
    where: {
      dimension: {
        topic: { versionId },
      },
    },
    select: { id: true },
  });

  const questionIds = allQuestions.map((q) => q.id);
  const answeredIds = Object.keys(answers);

  // Check all questions are answered
  const missing = questionIds.filter((id) => !answeredIds.includes(id));
  if (missing.length > 0) {
    return { errors: { _form: [`Please answer all questions. ${missing.length} remaining.`] } };
  }

  // Validate all selected options exist and belong to the right questions
  const selectedOptionIds = Object.values(answers);
  const validOptions = await prisma.answerOption.findMany({
    where: { id: { in: selectedOptionIds } },
    select: { id: true, questionId: true },
  });

  const optionMap = new Map(validOptions.map((o) => [o.id, o.questionId]));
  for (const [questionId, optionId] of Object.entries(answers)) {
    const ownerQuestion = optionMap.get(optionId);
    if (!ownerQuestion || ownerQuestion !== questionId) {
      return { errors: { _form: ['Invalid answer option selected.'] } };
    }
  }

  // Create snapshot + answers in a single transaction
  await prisma.$transaction(async (tx) => {
    const snapshot = await tx.responseSnapshot.create({
      data: {
        userId,
        versionId,
        context: 'initial',
      },
    });

    await tx.responseAnswer.createMany({
      data: Object.entries(answers).map(([questionId, selectedOptionId]) => ({
        snapshotId: snapshot.id,
        questionId,
        selectedOptionId,
      })),
    });
  });

  redirect('/dashboard');
}

/**
 * Submit a questionnaire update with activity context (post-activity growth loop).
 * Creates a new ResponseSnapshot referencing the activity.
 */
export async function submitQuestionnaireUpdate(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;

  const activityId = formData.get('activityId') as string | null;

  // Validate activityId: user must be a member and activity must be COMPLETED
  if (activityId) {
    const membership = await (prisma as any).membership.findUnique({
      where: { activityId_userId: { activityId, userId } },
      select: { activity: { select: { status: true } } },
    }) as { activity: { status: string } } | null;

    if (!membership) {
      return { errors: { _form: ['You are not a member of this activity.'] } };
    }
    if (membership.activity.status !== 'COMPLETED') {
      return { errors: { _form: ['Activity must be completed before updating questionnaire.'] } };
    }
  }

  const rawAnswers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('answer_') && typeof value === 'string') {
      const questionId = key.replace('answer_', '');
      rawAnswers[questionId] = value;
    }
  }

  const parsed = submitQuestionnaireSchema.safeParse({
    versionId: formData.get('versionId'),
    answers: rawAnswers,
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const { versionId, answers } = parsed.data;

  // Verify the version is active
  const version = await prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    select: { isActive: true },
  });
  if (!version?.isActive) {
    return { errors: { _form: ['This questionnaire version is no longer active.'] } };
  }

  // Get all questions for this version to validate completeness
  const allQuestions = await prisma.question.findMany({
    where: { dimension: { topic: { versionId } } },
    select: { id: true },
  });

  const questionIds = allQuestions.map((q) => q.id);
  const answeredIds = Object.keys(answers);
  const missing = questionIds.filter((id) => !answeredIds.includes(id));
  if (missing.length > 0) {
    return { errors: { _form: [`Please answer all questions. ${missing.length} remaining.`] } };
  }

  // Validate all selected options belong to the right questions
  const selectedOptionIds = Object.values(answers);
  const validOptions = await prisma.answerOption.findMany({
    where: { id: { in: selectedOptionIds } },
    select: { id: true, questionId: true },
  });
  const optionMap = new Map(validOptions.map((o) => [o.id, o.questionId]));
  for (const [questionId, optionId] of Object.entries(answers)) {
    const ownerQuestion = optionMap.get(optionId);
    if (!ownerQuestion || ownerQuestion !== questionId) {
      return { errors: { _form: ['Invalid answer option selected.'] } };
    }
  }

  // Build context string with activity info
  let contextStr = 'update';
  if (activityId) {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        activityTags: { include: { tag: { select: { name: true } } } },
      },
    });
    if (activity) {
      const tags = activity.activityTags.map((at) => at.tag.name);
      contextStr = JSON.stringify({
        type: 'activity',
        activityId: activity.id,
        tags,
      });
    }
  }

  // Create snapshot + answers in a single transaction
  await prisma.$transaction(async (tx) => {
    const snapshot = await tx.responseSnapshot.create({
      data: {
        userId,
        versionId,
        context: contextStr,
        activityId: activityId || null,
      },
    });

    await tx.responseAnswer.createMany({
      data: Object.entries(answers).map(([questionId, selectedOptionId]) => ({
        snapshotId: snapshot.id,
        questionId,
        selectedOptionId,
      })),
    });
  });

  if (activityId) {
    redirect(`/cognitive-report`);
  }
  redirect('/cognitive-report');
}

export async function validateAnswerOptionsSum(questionId: string): Promise<ActionState> {
  await requireAdmin();

  const options = await prisma.answerOption.findMany({
    where: { questionId },
    select: { score: true },
  });

  const sum = options.reduce((acc, o) => acc + o.score, 0);
  if (sum !== 100) {
    return {
      errors: {
        _form: [`Score sum is ${sum}. Must equal 100.`],
      },
    };
  }

  return { success: true };
}
