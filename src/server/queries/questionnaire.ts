import { prisma } from '@/lib/db';

export async function getQuestionnaireVersions() {
  return prisma.questionnaireVersion.findMany({
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      isActive: true,
      createdAt: true,
    },
  });
}

export async function getVersionStructure(versionId: string) {
  return prisma.questionnaireVersion.findUnique({
    where: { id: versionId },
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
                  answerOptions: {
                    orderBy: { order: 'asc' },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function getActiveVersion() {
  return prisma.questionnaireVersion.findFirst({
    where: { isActive: true },
    select: { id: true, version: true },
  });
}

export async function getQuestionWithOptions(questionId: string) {
  return prisma.question.findUnique({
    where: { id: questionId },
    include: {
      answerOptions: {
        orderBy: { order: 'asc' },
      },
      dimension: {
        include: {
          topic: {
            include: {
              version: {
                select: { id: true, version: true, isActive: true },
              },
            },
          },
        },
      },
    },
  });
}
