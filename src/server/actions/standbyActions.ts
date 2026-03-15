'use server';

/**
 * Standby User Server Actions (Admin only)
 */

import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import {
  addStandbyUser,
  removeStandbyUser,
  getAllStandbyUsers,
  checkTimeoutAndFillStandby,
} from '@/server/services/standby';
import { searchUsersLite } from '@/server/queries/admin';

/** Admin: Add a user as standby */
export async function addStandby(userId: string, note?: string) {
  const session = await requireAdmin();

  // Validate user exists before attempting upsert
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!user) {
    throw new Error('该用户不存在');
  }

  await addStandbyUser(userId, session.user.id, note);
  revalidatePath('/admin/communities');
  return { success: true };
}

/** Admin: Remove standby status */
export async function removeStandby(userId: string) {
  await requireAdmin();
  await removeStandbyUser(userId);
  revalidatePath('/admin/communities');
  return { success: true };
}

/** Admin: Get all standby users */
export async function getStandbyUsers() {
  await requireAdmin();
  return getAllStandbyUsers();
}

/** Admin: Trigger timeout check and standby fill */
export async function triggerStandbyFill() {
  await requireAdmin();
  const result = await checkTimeoutAndFillStandby();
  revalidatePath('/admin/communities');
  return { success: true, ...result };
}

/** Admin: Search users for standby management (lightweight, paginated) */
export async function searchUsersForStandbyAction(page: number = 1, query?: string) {
  await requireAdmin();

  // Fetch paginated users and current standby user IDs in parallel
  const [usersResult, standbyUsers] = await Promise.all([
    searchUsersLite({ page, query }),
    prisma.standbyUser.findMany({
      where: { status: { in: ['AVAILABLE', 'MATCHED'] } },
      select: { userId: true },
    }),
  ]);

  // Return standby IDs as string[] (Set is not serializable through Server Actions)
  const standbyUserIds = standbyUsers.map((s) => s.userId);

  return {
    users: usersResult.users,
    total: usersResult.total,
    pageSize: usersResult.pageSize,
    standbyUserIds,
  };
}
