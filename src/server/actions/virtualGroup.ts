'use server';

/**
 * Virtual Group Server Actions
 *
 * Provides authenticated endpoints for virtual group operations.
 */

import { requireAuth, requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import {
  getUserVirtualGroups,
  getVirtualGroupDetails,
  removeMemberFromGroup,
} from '@/server/services/virtualGroup';
import { fillGroupWithStandby } from '@/server/services/activityMatching';
import { prisma } from '@/lib/db';

/** Get all virtual groups for the current user */
export async function getMyVirtualGroups() {
  const session = await requireAuth();
  return getUserVirtualGroups(session.user.id);
}

/** Get details of a specific virtual group (must be a member) */
export async function getGroupDetails(groupId: string) {
  const session = await requireAuth();
  const details = await getVirtualGroupDetails(groupId);
  // Verify user is a member
  const isMember = details?.members.some((m) => m.userId === session.user.id);
  const isAdmin = session.user.role === 'ADMIN';
  if (!isMember && !isAdmin) {
    throw new Error('You are not a member of this group');
  }
  return details;
}

/** Leave a virtual group (user action) */
export async function leaveGroup(groupId: string) {
  try {
    const session = await requireAuth();
    await removeMemberFromGroup(groupId, session.user.id);
    revalidatePath('/dashboard');
    revalidatePath('/activities');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '退出小组失败';
    return { errors: { _form: [message] } };
  }
}

/** Modify group leadership (leader action - reassign leader) */
export async function reassignGroupLeader(
  groupId: string,
  newLeaderId: string,
) {
  try {
    const session = await requireAuth();
    const details = await getVirtualGroupDetails(groupId);
    if (
      details?.leaderId !== session.user.id &&
      session.user.role !== 'ADMIN'
    ) {
      throw new Error('Only the group leader or admin can reassign leadership');
    }
    await prisma.virtualGroup.update({
      where: { id: groupId },
      data: { leaderId: newLeaderId },
    });
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '重新分配组长失败';
    return { errors: { _form: [message] } };
  }
}

/** Admin: Trigger standby fill for a group */
export async function adminFillGroupWithStandby(groupId: string) {
  try {
    await requireAdmin();
    await fillGroupWithStandby(groupId);
    revalidatePath('/admin/communities');
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '候补填充失败';
    return { errors: { _form: [message] } };
  }
}
