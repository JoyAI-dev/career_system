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

export async function getDashboardStats() {
  const [
    totalUsers,
    activitiesByStatus,
    totalSnapshots,
    usersWithSnapshots,
    recentUsers,
    activitiesNearCapacity,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'USER' } }),

    prisma.activity.groupBy({
      by: ['status'],
      _count: { id: true },
    }),

    prisma.responseSnapshot.count(),

    prisma.responseSnapshot.findMany({
      select: { userId: true },
      distinct: ['userId'],
    }),

    prisma.user.findMany({
      where: { role: 'USER' },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        username: true,
        name: true,
        school: true,
        createdAt: true,
      },
    }),

    prisma.activity.findMany({
      where: { status: 'OPEN' },
      select: {
        id: true,
        title: true,
        capacity: true,
        _count: { select: { memberships: true } },
      },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of activitiesByStatus as { status: string; _count: { id: number } }[]) {
    statusCounts[row.status] = row._count.id;
  }

  type NearCapacityRow = { id: string; title: string; capacity: number; _count: { memberships: number } };
  const nearCapacity = (activitiesNearCapacity as NearCapacityRow[])
    .filter((a) => a._count.memberships >= a.capacity * 0.8 && a._count.memberships < a.capacity)
    .map((a) => ({
      id: a.id,
      title: a.title,
      members: a._count.memberships,
      capacity: a.capacity,
    }));

  const completionRate =
    totalUsers > 0
      ? Math.round((usersWithSnapshots.length / totalUsers) * 100)
      : 0;

  type RecentUser = { id: string; username: string; name: string | null; school: string | null; createdAt: Date };
  return {
    totalUsers,
    statusCounts,
    totalSnapshots,
    completionRate,
    recentUsers: (recentUsers as RecentUser[]).map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
    })),
    nearCapacity,
  };
}
