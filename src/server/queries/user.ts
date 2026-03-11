import { prisma } from '@/lib/db';

export async function getUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      school: true,
      major: true,
      grade: true,
      studentIdUrl: true,
    },
  });
}

export async function getActiveGradeOptions() {
  return prisma.gradeOption.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      label: true,
    },
  });
}
