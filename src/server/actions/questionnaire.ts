'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin, requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

const ADMIN_PATH = '/admin/questionnaire';

// ─── Zod Schema Factories ───────────────────────────────────────────

function getCreateTopicSchema(t: (key: string) => string) {
  return z.object({
    versionId: z.string().min(1, t('versionRequired')),
    name: z.string().min(1, t('nameRequired')).max(200),
  });
}

function getUpdateTopicSchema(t: (key: string) => string) {
  return z.object({
    id: z.string().min(1),
    name: z.string().min(1, t('nameRequired')).max(200),
  });
}

function getCreateDimensionSchema(t: (key: string) => string) {
  return z.object({
    topicId: z.string().min(1, t('topicRequired')),
    name: z.string().min(1, t('nameRequired')).max(200),
  });
}

function getUpdateDimensionSchema(t: (key: string) => string) {
  return z.object({
    id: z.string().min(1),
    name: z.string().min(1, t('nameRequired')).max(200),
  });
}

function getCreateQuestionSchema(t: (key: string) => string) {
  return z.object({
    dimensionId: z.string().min(1, t('dimensionRequired')),
    title: z.string().min(1, t('titleRequired')).max(500),
  });
}

function getUpdateQuestionSchema(t: (key: string) => string) {
  return z.object({
    id: z.string().min(1),
    title: z.string().min(1, t('titleRequired')).max(500),
  });
}

function getCreateNoteSchema(t: (key: string) => string) {
  return z.object({
    questionId: z.string().min(1, t('questionRequired')),
    label: z.string().min(1, t('labelRequired')).max(100),
    content: z.string().min(1, t('contentRequired')).max(2000),
  });
}

function getUpdateNoteSchema(t: (key: string) => string) {
  return z.object({
    id: z.string().min(1),
    label: z.string().min(1, t('labelRequired')).max(100),
    content: z.string().min(1, t('contentRequired')).max(2000),
  });
}

function getAnswerOptionSchema(t: (key: string) => string) {
  return z.object({
    label: z.string().min(1, t('labelRequired')).max(200),
    score: z.coerce.number().int().min(0, t('scoreMin')).max(100, t('scoreMax')),
  });
}

function getCreateAnswerOptionSchema(t: (key: string) => string) {
  return getAnswerOptionSchema(t).extend({
    questionId: z.string().min(1, t('questionRequired')),
  });
}

function getUpdateAnswerOptionSchema(t: (key: string) => string) {
  return getAnswerOptionSchema(t).extend({
    id: z.string().min(1),
  });
}

function getSubmitQuestionnaireSchema(t: (key: string) => string) {
  return z.object({
    versionId: z.string().min(1),
    answers: z.record(z.string(), z.string()).refine(
      (val) => Object.keys(val).length > 0,
      t('atLeastOneAnswer'),
    ),
  });
}

// ─── State Types ────────────────────────────────────────────────────

export type ActionState = {
  errors?: { [key: string]: string[] };
  success?: boolean;
};

// ─── Helper: Verify version is a draft (not active) ────────────────

async function requireDraftVersion(versionId: string, te: (key: string) => string) {
  const version = await prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    select: { isActive: true },
  });
  if (!version) throw new Error(te('versionNotFound'));
  if (version.isActive) throw new Error(te('cannotModifyActive'));
  return version;
}

async function getVersionIdFromTopic(topicId: string, te: (key: string) => string) {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { versionId: true },
  });
  if (!topic) throw new Error(te('topicNotFound'));
  return topic.versionId;
}

async function getVersionIdFromDimension(dimensionId: string, te: (key: string) => string) {
  const dimension = await prisma.dimension.findUnique({
    where: { id: dimensionId },
    include: { topic: { select: { versionId: true } } },
  });
  if (!dimension) throw new Error(te('dimensionNotFound'));
  return dimension.topic.versionId;
}

async function getVersionIdFromQuestion(questionId: string, te: (key: string) => string) {
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: {
      dimension: {
        include: { topic: { select: { versionId: true } } },
      },
    },
  });
  if (!question) throw new Error(te('questionNotFound'));
  return question.dimension.topic.versionId;
}

// ─── Version Management ─────────────────────────────────────────────

export async function createDraftVersion(): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const existing = await prisma.questionnaireVersion.findFirst({
    where: { isActive: false },
    select: { id: true },
  });
  if (existing) {
    return { errors: { _form: [te('draftAlreadyExists')] } };
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
  const te = await getTranslations('serverErrors');

  const version = await prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    select: { isActive: true },
  });
  if (!version) return { errors: { _form: [te('versionNotFound')] } };
  if (version.isActive) return { errors: { _form: [te('versionAlreadyActive')] } };

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
  const te = await getTranslations('serverErrors');

  const version = await prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    select: { id: true },
  });
  if (!version) return { errors: { _form: [te('versionNotFound')] } };

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
  const te = await getTranslations('serverErrors');

  const version = await prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    select: { isActive: true },
  });
  if (!version) return { errors: { _form: [te('versionNotFound')] } };
  if (version.isActive) return { errors: { _form: [te('cannotDeleteActive')] } };

  await prisma.questionnaireVersion.delete({ where: { id: versionId } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

// ─── Bulk Import ───────────────────────────────────────────────────

export type ImportTopic = {
  name: string;
  dimensions: {
    name: string;
    questions: string[];
  }[];
};

export async function importQuestionnaireStructure(
  versionId: string,
  topics: ImportTopic[],
): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  await requireDraftVersion(versionId, te);

  // Get current max order for topics in this version
  const maxTopic = await prisma.topic.findFirst({
    where: { versionId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  let topicOrder = (maxTopic?.order ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    for (const topic of topics) {
      const newTopic = await tx.topic.create({
        data: {
          versionId,
          name: topic.name,
          order: topicOrder++,
        },
      });

      let dimOrder = 1;
      for (const dim of topic.dimensions) {
        const newDim = await tx.dimension.create({
          data: {
            topicId: newTopic.id,
            name: dim.name,
            order: dimOrder++,
          },
        });

        let qOrder = 1;
        for (const questionTitle of dim.questions) {
          await tx.question.create({
            data: {
              dimensionId: newDim.id,
              title: questionTitle,
              order: qOrder++,
            },
          });
        }
      }
    }
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

// ─── Topic CRUD ─────────────────────────────────────────────────────

export async function createTopic(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const createTopicSchema = getCreateTopicSchema(tv);

  const parsed = createTopicSchema.safeParse({
    versionId: formData.get('versionId'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  await requireDraftVersion(parsed.data.versionId, te);

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
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const updateTopicSchema = getUpdateTopicSchema(tv);

  const parsed = updateTopicSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromTopic(parsed.data.id, te);
  await requireDraftVersion(versionId, te);

  await prisma.topic.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteTopic(topicId: string): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const versionId = await getVersionIdFromTopic(topicId, te);
  await requireDraftVersion(versionId, te);

  await prisma.topic.delete({ where: { id: topicId } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function reorderTopic(
  topicId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const topic = await prisma.topic.findUnique({ where: { id: topicId } });
  if (!topic) return { errors: { _form: [te('topicNotFound')] } };

  await requireDraftVersion(topic.versionId, te);

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
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const createDimensionSchema = getCreateDimensionSchema(tv);

  const parsed = createDimensionSchema.safeParse({
    topicId: formData.get('topicId'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromTopic(parsed.data.topicId, te);
  await requireDraftVersion(versionId, te);

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
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const updateDimensionSchema = getUpdateDimensionSchema(tv);

  const parsed = updateDimensionSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromDimension(parsed.data.id, te);
  await requireDraftVersion(versionId, te);

  await prisma.dimension.update({
    where: { id: parsed.data.id },
    data: { name: parsed.data.name },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteDimension(dimensionId: string): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const versionId = await getVersionIdFromDimension(dimensionId, te);
  await requireDraftVersion(versionId, te);

  await prisma.dimension.delete({ where: { id: dimensionId } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function reorderDimension(
  dimensionId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const dim = await prisma.dimension.findUnique({ where: { id: dimensionId } });
  if (!dim) return { errors: { _form: [te('dimensionNotFound')] } };

  const versionId = await getVersionIdFromTopic(dim.topicId, te);
  await requireDraftVersion(versionId, te);

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
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const createQuestionSchema = getCreateQuestionSchema(tv);

  const parsed = createQuestionSchema.safeParse({
    dimensionId: formData.get('dimensionId'),
    title: formData.get('title'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromDimension(parsed.data.dimensionId, te);
  await requireDraftVersion(versionId, te);

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
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const updateQuestionSchema = getUpdateQuestionSchema(tv);

  const parsed = updateQuestionSchema.safeParse({
    id: formData.get('id'),
    title: formData.get('title'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromQuestion(parsed.data.id, te);
  await requireDraftVersion(versionId, te);

  await prisma.question.update({
    where: { id: parsed.data.id },
    data: { title: parsed.data.title },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteQuestion(questionId: string): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const versionId = await getVersionIdFromQuestion(questionId, te);
  await requireDraftVersion(versionId, te);

  await prisma.question.delete({ where: { id: questionId } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function reorderQuestion(
  questionId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const q = await prisma.question.findUnique({ where: { id: questionId } });
  if (!q) return { errors: { _form: [te('questionNotFound')] } };

  const versionId = await getVersionIdFromDimension(q.dimensionId, te);
  await requireDraftVersion(versionId, te);

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
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const createNoteSchema = getCreateNoteSchema(tv);

  const parsed = createNoteSchema.safeParse({
    questionId: formData.get('questionId'),
    label: formData.get('label'),
    content: formData.get('content'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromQuestion(parsed.data.questionId, te);
  await requireDraftVersion(versionId, te);

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
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const updateNoteSchema = getUpdateNoteSchema(tv);

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
  if (!note) return { errors: { _form: [te('noteNotFound')] } };

  const versionId = await getVersionIdFromQuestion(note.questionId, te);
  await requireDraftVersion(versionId, te);

  await prisma.questionNote.update({
    where: { id: parsed.data.id },
    data: { label: parsed.data.label, content: parsed.data.content },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteQuestionNote(noteId: string): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const note = await prisma.questionNote.findUnique({
    where: { id: noteId },
    select: { questionId: true },
  });
  if (!note) return { errors: { _form: [te('noteNotFound')] } };

  const versionId = await getVersionIdFromQuestion(note.questionId, te);
  await requireDraftVersion(versionId, te);

  await prisma.questionNote.delete({ where: { id: noteId } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

// ─── Answer Option CRUD ─────────────────────────────────────────────

export async function createAnswerOption(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const createAnswerOptionSchema = getCreateAnswerOptionSchema(tv);

  const parsed = createAnswerOptionSchema.safeParse({
    questionId: formData.get('questionId'),
    label: formData.get('label'),
    score: formData.get('score'),
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };

  const versionId = await getVersionIdFromQuestion(parsed.data.questionId, te);
  await requireDraftVersion(versionId, te);

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
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const updateAnswerOptionSchema = getUpdateAnswerOptionSchema(tv);

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
  if (!option) return { errors: { _form: [te('optionNotFound')] } };

  const versionId = await getVersionIdFromQuestion(option.questionId, te);
  await requireDraftVersion(versionId, te);

  await prisma.answerOption.update({
    where: { id: parsed.data.id },
    data: { label: parsed.data.label, score: parsed.data.score },
  });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function deleteAnswerOption(optionId: string): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const option = await prisma.answerOption.findUnique({
    where: { id: optionId },
    select: { questionId: true },
  });
  if (!option) return { errors: { _form: [te('optionNotFound')] } };

  const versionId = await getVersionIdFromQuestion(option.questionId, te);
  await requireDraftVersion(versionId, te);

  await prisma.answerOption.delete({ where: { id: optionId } });

  revalidatePath(ADMIN_PATH);
  return { success: true };
}

export async function reorderAnswerOption(
  optionId: string,
  direction: 'up' | 'down',
): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const option = await prisma.answerOption.findUnique({ where: { id: optionId } });
  if (!option) return { errors: { _form: [te('optionNotFound')] } };

  const versionId = await getVersionIdFromQuestion(option.questionId, te);
  await requireDraftVersion(versionId, te);

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

// ─── User Questionnaire Draft Save ──────────────────────────────────

export async function saveQuestionnaireDraft(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;
  const te = await getTranslations('serverErrors');

  const versionId = formData.get('versionId') as string;
  if (!versionId) {
    return { errors: { _form: [te('versionRequired')] } };
  }

  // Verify the version is active
  const version = await prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
    select: { isActive: true },
  });
  if (!version?.isActive) {
    return { errors: { _form: [te('questionnaireInactive')] } };
  }

  const rawAnswers: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('answer_') && typeof value === 'string') {
      const questionId = key.replace('answer_', '');
      rawAnswers[questionId] = value;
    }
  }

  if (Object.keys(rawAnswers).length === 0) {
    return { errors: { _form: [te('atLeastOneAnswer')] } };
  }

  // Validate all selected options belong to the right questions
  const selectedOptionIds = Object.values(rawAnswers);
  const validOptions = await prisma.answerOption.findMany({
    where: { id: { in: selectedOptionIds } },
    select: { id: true, questionId: true },
  });
  const optionMap = new Map(validOptions.map((o) => [o.id, o.questionId]));
  for (const [questionId, optionId] of Object.entries(rawAnswers)) {
    const ownerQuestion = optionMap.get(optionId);
    if (!ownerQuestion || ownerQuestion !== questionId) {
      return { errors: { _form: [te('invalidAnswerOption')] } };
    }
  }

  // Save to the current (non-snapshot) record
  await prisma.$transaction(async (tx) => {
    const answerData = Object.entries(rawAnswers).map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId,
    }));

    const existingCurrent = await tx.responseSnapshot.findFirst({
      where: { userId, isSnapshot: false },
      orderBy: { completedAt: 'desc' },
      select: { id: true },
    });

    if (existingCurrent) {
      // Delete old answers and insert new ones
      await tx.responseAnswer.deleteMany({ where: { snapshotId: existingCurrent.id } });
      await tx.responseAnswer.createMany({
        data: answerData.map((a) => ({ ...a, snapshotId: existingCurrent.id })),
      });
      await tx.responseSnapshot.update({
        where: { id: existingCurrent.id },
        data: { versionId, completedAt: new Date() },
      });
    } else {
      const current = await tx.responseSnapshot.create({
        data: {
          userId,
          versionId,
          context: 'draft',
          isSnapshot: false,
        },
      });
      await tx.responseAnswer.createMany({
        data: answerData.map((a) => ({ ...a, snapshotId: current.id })),
      });
    }
  });

  return { success: true };
}

// ─── User Questionnaire Submission ───────────────────────────────────

export async function submitQuestionnaire(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const submitQuestionnaireSchema = getSubmitQuestionnaireSchema(tv);

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
    return { errors: { _form: [te('questionnaireInactive')] } };
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
      return { errors: { _form: [te('invalidAnswerOption')] } };
    }
  }

  // Save/update current record (editable) + ensure initial snapshot (frozen) exists.
  await prisma.$transaction(async (tx) => {
    const answerData = Object.entries(answers).map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId,
    }));

    // Upsert current editable record with submitted answers.
    const existingCurrent = await tx.responseSnapshot.findFirst({
      where: { userId, isSnapshot: false },
      orderBy: { completedAt: 'desc' },
      select: { id: true },
    });

    let currentId: string;
    if (existingCurrent) {
      currentId = existingCurrent.id;
      await tx.responseAnswer.deleteMany({ where: { snapshotId: currentId } });
      await tx.responseAnswer.createMany({
        data: answerData.map((a) => ({ ...a, snapshotId: currentId })),
      });
      await tx.responseSnapshot.update({
        where: { id: currentId },
        data: {
          versionId,
          context: 'initial',
          completedAt: new Date(),
        },
      });
    } else {
      const current = await tx.responseSnapshot.create({
        data: {
          userId,
          versionId,
          context: 'initial',
          isSnapshot: false,
          completedAt: new Date(),
        },
      });
      currentId = current.id;
      await tx.responseAnswer.createMany({
        data: answerData.map((a) => ({ ...a, snapshotId: currentId })),
      });
    }

    // Create the first frozen snapshot if the user has not completed yet.
    const existingSnapshot = await tx.responseSnapshot.findFirst({
      where: { userId, isSnapshot: true },
      select: { id: true },
    });
    if (!existingSnapshot) {
      const snapshot = await tx.responseSnapshot.create({
        data: {
          userId,
          versionId,
          context: 'initial',
          isSnapshot: true,
          snapshotLabel: null,
          completedAt: new Date(),
        },
      });
      await tx.responseAnswer.createMany({
        data: answerData.map((a) => ({ ...a, snapshotId: snapshot.id })),
      });
    }
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
  const tv = await getTranslations('validation');
  const te = await getTranslations('serverErrors');
  const submitQuestionnaireSchema = getSubmitQuestionnaireSchema(tv);

  const activityId = formData.get('activityId') as string | null;

  // Validate activityId: user must be a member
  if (activityId) {
    const membership = await (prisma as any).membership.findUnique({
      where: { activityId_userId: { activityId, userId } },
      select: { activity: { select: { id: true } } },
    }) as { activity: { id: string } } | null;

    if (!membership) {
      return { errors: { _form: [te('notActivityMember')] } };
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
    return { errors: { _form: [te('questionnaireInactive')] } };
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
      return { errors: { _form: [te('invalidAnswerOption')] } };
    }
  }

  // Build context string with activity info
  let contextStr = 'update';
  if (activityId) {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: {
        id: true,
        type: { select: { name: true } },
        activityTags: { include: { tag: { select: { name: true } } } },
      },
    });
    if (activity) {
      const tags = activity.activityTags.map((at) => at.tag.name);
      contextStr = JSON.stringify({
        type: 'activity',
        activityId: activity.id,
        activityType: activity.type.name,
        tags,
      });
    }
  }

  // Update current record + create frozen snapshot in a single transaction
  await prisma.$transaction(async (tx) => {
    const answerData = Object.entries(answers).map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId,
    }));

    // Update or create current record
    const existingCurrent = await tx.responseSnapshot.findFirst({
      where: { userId, isSnapshot: false },
      orderBy: { completedAt: 'desc' },
      select: { id: true },
    });

    if (existingCurrent) {
      // Delete old answers and insert new ones
      await tx.responseAnswer.deleteMany({ where: { snapshotId: existingCurrent.id } });
      await tx.responseAnswer.createMany({
        data: answerData.map((a) => ({ ...a, snapshotId: existingCurrent.id })),
      });
      await tx.responseSnapshot.update({
        where: { id: existingCurrent.id },
        data: { versionId, completedAt: new Date() },
      });
    } else {
      const current = await tx.responseSnapshot.create({
        data: { userId, versionId, isSnapshot: false, context: contextStr },
      });
      await tx.responseAnswer.createMany({
        data: answerData.map((a) => ({ ...a, snapshotId: current.id })),
      });
    }

    // Create frozen snapshot
    const snapshot = await tx.responseSnapshot.create({
      data: {
        userId,
        versionId,
        context: contextStr,
        activityId: activityId || null,
        isSnapshot: true,
      },
    });
    await tx.responseAnswer.createMany({
      data: answerData.map((a) => ({ ...a, snapshotId: snapshot.id })),
    });
  });

  redirect('/cognitive-report');
}

/**
 * Update a single answer in the user's current (editable) record.
 * If no current record exists, creates one from the latest snapshot.
 */
export async function updateCurrentAnswer(
  questionId: string,
  optionId: string,
): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;
  const te = await getTranslations('serverErrors');

  // Validate the option belongs to the question
  const option = await prisma.answerOption.findUnique({
    where: { id: optionId },
    select: { questionId: true },
  });
  if (!option || option.questionId !== questionId) {
    return { errors: { _form: [te('invalidAnswerOption')] } };
  }

  // Get active version
  const activeVersion = await prisma.questionnaireVersion.findFirst({
    where: { isActive: true },
    select: { id: true },
  });
  if (!activeVersion) {
    return { errors: { _form: [te('questionnaireInactive')] } };
  }

  await prisma.$transaction(async (tx) => {
    // Lock any existing current record to prevent concurrent duplicate creation
    await tx.$queryRaw`SELECT id FROM "response_snapshots" WHERE "userId" = ${userId} AND "isSnapshot" = false LIMIT 1 FOR UPDATE`;

    let currentRecord = await tx.responseSnapshot.findFirst({
      where: { userId, isSnapshot: false },
      orderBy: { completedAt: 'desc' },
      select: { id: true },
    });

    if (!currentRecord) {
      // Create current record from latest snapshot
      const latestSnapshot = await tx.responseSnapshot.findFirst({
        where: { userId, isSnapshot: true },
        orderBy: { completedAt: 'desc' },
        include: { answers: { select: { questionId: true, selectedOptionId: true } } },
      });

      const newCurrent = await tx.responseSnapshot.create({
        data: {
          userId,
          versionId: activeVersion.id,
          isSnapshot: false,
          context: 'current',
        },
      });

      if (latestSnapshot) {
        await tx.responseAnswer.createMany({
          data: latestSnapshot.answers.map((a) => ({
            snapshotId: newCurrent.id,
            questionId: a.questionId,
            selectedOptionId: a.selectedOptionId,
          })),
        });
      }

      currentRecord = { id: newCurrent.id };
    }

    // Upsert the answer
    const existingAnswer = await tx.responseAnswer.findFirst({
      where: { snapshotId: currentRecord.id, questionId },
    });

    if (existingAnswer) {
      await tx.responseAnswer.update({
        where: { id: existingAnswer.id },
        data: { selectedOptionId: optionId },
      });
    } else {
      await tx.responseAnswer.create({
        data: {
          snapshotId: currentRecord.id,
          questionId,
          selectedOptionId: optionId,
        },
      });
    }
  });

  revalidatePath('/cognitive-report');
  return { success: true };
}

/**
 * Create a named snapshot from the user's current state.
 */
export async function createSnapshot(label?: string): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;

  const currentRecord = await prisma.responseSnapshot.findFirst({
    where: { userId, isSnapshot: false },
    orderBy: { completedAt: 'desc' },
    include: { answers: { select: { questionId: true, selectedOptionId: true } } },
  });

  if (!currentRecord || currentRecord.answers.length === 0) {
    return { errors: { _form: ['No current answers to snapshot'] } };
  }

  await prisma.$transaction(async (tx) => {
    const snapshot = await tx.responseSnapshot.create({
      data: {
        userId,
        versionId: currentRecord.versionId,
        isSnapshot: true,
        snapshotLabel: label || null,
        context: 'manual',
      },
    });
    await tx.responseAnswer.createMany({
      data: currentRecord.answers.map((a) => ({
        snapshotId: snapshot.id,
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
      })),
    });
  });

  revalidatePath('/cognitive-report');
  return { success: true };
}

export async function validateAnswerOptionsSum(questionId: string): Promise<ActionState> {
  await requireAdmin();
  const te = await getTranslations('serverErrors');

  const options = await prisma.answerOption.findMany({
    where: { questionId },
    select: { score: true, order: true },
    orderBy: { order: 'asc' },
  });

  // Validate that scores are strictly ascending
  for (let i = 1; i < options.length; i++) {
    if (options[i].score <= options[i - 1].score) {
      return {
        errors: {
          _form: [te('scoresNotAscending')],
        },
      };
    }
  }

  return { success: true };
}
