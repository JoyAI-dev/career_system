import { prisma } from '@/lib/db';
import type { Prisma } from '@prisma/client';

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

export type UserListItem = {
  id: string;
  username: string;
  name: string | null;
  school: string | null;
  major: string | null;
  grade: string | null;
  role: string;
  createdAt: string;
  hasSnapshot: boolean;
};

export async function searchUsers({
  query,
  page = 1,
  sortBy = 'createdAt',
  sortOrder = 'desc',
}: {
  query?: string;
  page?: number;
  sortBy?: 'createdAt' | 'username';
  sortOrder?: 'asc' | 'desc';
}): Promise<{ users: UserListItem[]; total: number }> {
  const take = 20;
  const skip = (page - 1) * take;

  const where: Prisma.UserWhereInput = query
    ? {
        OR: [
          { username: { contains: query, mode: 'insensitive' as const } },
          { school: { contains: query, mode: 'insensitive' as const } },
          { major: { contains: query, mode: 'insensitive' as const } },
          { name: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const orderBy = { [sortBy]: sortOrder };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy,
      take,
      skip,
      select: {
        id: true,
        username: true,
        name: true,
        school: true,
        major: true,
        grade: true,
        role: true,
        createdAt: true,
        _count: { select: { responseSnapshots: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      school: u.school,
      major: u.major,
      grade: u.grade,
      role: String(u.role),
      createdAt: u.createdAt.toISOString(),
      hasSnapshot: u._count.responseSnapshots > 0,
    })),
    total,
  };
}

export async function getUserDetail(userId: string) {
  const [user, snapshotCount, activityCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        name: true,
        school: true,
        major: true,
        grade: true,
        role: true,
        studentIdUrl: true,
        createdAt: true,
      },
    }),
    prisma.responseSnapshot.count({ where: { userId } }),
    (prisma as any).membership.count({ where: { userId } }) as Promise<number>,
  ]);

  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    name: user.name,
    school: user.school,
    major: user.major,
    grade: user.grade,
    role: String(user.role),
    studentIdUrl: user.studentIdUrl,
    createdAt: user.createdAt.toISOString(),
    snapshotCount,
    activityCount,
  };
}
