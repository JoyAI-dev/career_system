'use server';

/**
 * Standby User Server Actions (Admin only)
 */

import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  addStandbyUser,
  removeStandbyUser,
  getAllStandbyUsers,
  checkTimeoutAndFillStandby,
} from '@/server/services/standby';

/** Admin: Add a user as standby */
export async function addStandby(userId: string, note?: string) {
  const session = await requireAdmin();
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
