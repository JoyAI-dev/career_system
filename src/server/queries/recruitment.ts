import { prisma } from '@/lib/db';

export async function getRecruitmentInfos() {
  return prisma.recruitmentInfo.findMany({
    orderBy: { eventDate: 'desc' },
    include: {
      creator: { select: { id: true, name: true, username: true } },
    },
  });
}

export async function getRecruitmentEvents() {
  return prisma.recruitmentInfo.findMany({
    select: {
      id: true,
      title: true,
      company: true,
      description: true,
      eventDate: true,
    },
    orderBy: { eventDate: 'asc' },
  });
}
