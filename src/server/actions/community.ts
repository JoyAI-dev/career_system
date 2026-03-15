'use server';

import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { recomputeAllCommunities } from '@/server/services/community';
import { invalidateCache } from '@/server/services/communityCache';

export type CommunityActionState = {
  errors?: { _form?: string[] };
  success?: boolean;
  message?: string;
};

export async function updateCommunitySettings(
  _prevState: CommunityActionState,
  formData: FormData,
): Promise<CommunityActionState> {
  await requireAdmin();

  const autoDeleteEmpty = formData.get('autoDeleteEmpty') === 'true';

  await prisma.systemSetting.upsert({
    where: { key: 'community_auto_delete_empty' },
    update: { value: String(autoDeleteEmpty) },
    create: { key: 'community_auto_delete_empty', value: String(autoDeleteEmpty) },
  });

  invalidateCache('community:');
  revalidatePath('/admin/communities');
  return { success: true };
}

export async function updateHierarchicalMatchLevel(
  categoryId: string,
  level: string,
): Promise<CommunityActionState> {
  await requireAdmin();

  if (level !== 'PARENT' && level !== 'LEAF') {
    return { errors: { _form: ['Invalid match level'] } };
  }

  await prisma.preferenceCategory.update({
    where: { id: categoryId },
    data: { hierarchicalMatchLevel: level },
  });

  invalidateCache('community:');
  revalidatePath('/admin/communities');
  return { success: true, message: `Match level updated to ${level}` };
}

export async function triggerRecompute(): Promise<CommunityActionState> {
  await requireAdmin();

  try {
    const result = await recomputeAllCommunities();
    invalidateCache('community:');
    revalidatePath('/admin/communities');
    return {
      success: true,
      message: `Recomputed: ${result.processed} users, ${result.communities} communities created`,
    };
  } catch (error) {
    return {
      errors: { _form: [`Recompute failed: ${error instanceof Error ? error.message : 'Unknown error'}`] },
    };
  }
}

// ── Data fetching actions (called from client CommunityManager) ──

export async function fetchCommunityListAction(page: number, pageSize: number) {
  await requireAdmin();
  const { getCommunityList } = await import('@/server/queries/community');
  return getCommunityList(page, pageSize);
}

export async function fetchDrilldownAction(path: string[]) {
  await requireAdmin();
  const { getCommunityDrilldown } = await import('@/server/queries/community');
  return getCommunityDrilldown(path);
}

export async function fetchStatsAction() {
  await requireAdmin();
  const { getCommunityStats } = await import('@/server/queries/community');
  return getCommunityStats();
}

export async function fetchCommunityVirtualGroupsAction(communityId: string) {
  await requireAdmin();
  const { getCommunityVirtualGroups } = await import('@/server/queries/virtualGroup');
  return getCommunityVirtualGroups(communityId);
}

export async function fetchCommunityMemberDetailsAction(communityId: string) {
  await requireAdmin();
  const { getCommunityMemberDetails } = await import('@/server/queries/community');
  return getCommunityMemberDetails(communityId);
}

// Track user activity (called from ActivityTracker component)
export async function trackActivity(): Promise<void> {
  // Import auth dynamically to avoid circular deps
  const { auth } = await import('@/lib/auth');
  const session = await auth();
  if (!session?.user?.id) return;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastActiveAt: new Date() },
  }).catch(() => {
    // Ignore errors (e.g., user deleted)
  });
}
