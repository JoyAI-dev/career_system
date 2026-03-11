import { prisma } from '@/lib/db';

export async function getAllGradeOptions() {
  return prisma.gradeOption.findMany({
    orderBy: { order: 'asc' },
  });
}

export async function getSystemSetting(key: string) {
  const setting = await prisma.systemSetting.findUnique({ where: { key } });
  return setting?.value ?? null;
}
