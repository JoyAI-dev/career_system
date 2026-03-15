import { prisma } from '@/lib/db';
import { getCached, setCache } from '@/server/services/communityCache';

// ── Types ──────────────────────────────────────────────────────────

export interface CommunityStats {
  totalCommunities: number;
  totalMembers: number;
  activeMembers5min: number;
}

export interface CommunityListItem {
  id: string;
  name: string;
  fingerprint: string;
  memberCount: number;
  createdAt: Date;
  tags: Array<{
    category: { id: string; name: string; slug: string; order: number };
    option: { id: string; label: string; value: string };
  }>;
}

export interface DrilldownNode {
  optionId: string;
  label: string;
  communityCount: number;
  memberCount: number;
}

export interface DrilldownResult {
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  depth: number;
  nodes: DrilldownNode[];
  totalCommunities: number;
}

export interface GroupingCategory {
  id: string;
  name: string;
  slug: string;
  order: number;
  inputType: string;
  isGroupingBasis: boolean;
  hierarchicalMatchLevel: string | null;
}

// ── Queries ────────────────────────────────────────────────────────

export async function getCommunityStats(): Promise<CommunityStats> {
  const cacheKey = 'community:stats';
  const cached = getCached<CommunityStats>(cacheKey);
  if (cached) return cached;

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [totalCommunities, totalMembersResult, activeMembers5min] = await Promise.all([
    prisma.community.count(),
    prisma.communityMember.groupBy({
      by: ['userId'],
      _count: true,
    }),
    prisma.user.count({
      where: { lastActiveAt: { gte: fiveMinAgo } },
    }),
  ]);

  // Total unique members (users who are in at least one community)
  const totalMembers = totalMembersResult.length;

  const stats: CommunityStats = { totalCommunities, totalMembers, activeMembers5min };
  setCache(cacheKey, stats, 30000);
  return stats;
}

export async function getCommunityList(
  page: number = 1,
  pageSize: number = 20,
): Promise<{ communities: CommunityListItem[]; total: number }> {
  const cacheKey = `community:list:${page}:${pageSize}`;
  const cached = getCached<{ communities: CommunityListItem[]; total: number }>(cacheKey);
  if (cached) return cached;

  const [communities, total] = await Promise.all([
    prisma.community.findMany({
      orderBy: { memberCount: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        tags: {
          include: {
            category: { select: { id: true, name: true, slug: true, order: true } },
            option: { select: { id: true, label: true, value: true } },
          },
          orderBy: { category: { order: 'asc' } },
        },
      },
    }),
    prisma.community.count(),
  ]);

  const result = { communities, total };
  setCache(cacheKey, result, 30000);
  return result;
}

export async function getCommunityDrilldown(
  path: string[] = [],
): Promise<DrilldownResult | null> {
  const cacheKey = `community:drilldown:${path.join(',')}`;
  const cached = getCached<DrilldownResult>(cacheKey);
  if (cached) return cached;

  // Get grouping categories in order
  const groupingCategories = await prisma.preferenceCategory.findMany({
    where: { isGroupingBasis: true, isActive: true },
    orderBy: { order: 'asc' },
    select: { id: true, name: true, slug: true, order: true },
  });

  if (groupingCategories.length === 0) return null;

  const depth = path.length;
  if (depth >= groupingCategories.length) return null;

  const currentCategory = groupingCategories[depth];

  // Build filter: communities that match all previous path selections
  const pathFilters: { communityId: string }[][] = [];
  for (let i = 0; i < path.length; i++) {
    const catId = groupingCategories[i].id;
    const optId = path[i];
    const matchingCommunities = await prisma.communityTag.findMany({
      where: { categoryId: catId, optionId: optId },
      select: { communityId: true },
    });
    pathFilters.push(matchingCommunities);
  }

  // Intersect all path filters to get candidate community IDs
  let candidateIds: string[] | null = null;
  for (const filter of pathFilters) {
    const ids = new Set(filter.map(f => f.communityId));
    if (candidateIds === null) {
      candidateIds = [...ids];
    } else {
      candidateIds = candidateIds.filter(id => ids.has(id));
    }
  }

  // Get drilldown data for the current category level
  const whereClause = candidateIds
    ? { categoryId: currentCategory.id, communityId: { in: candidateIds } }
    : { categoryId: currentCategory.id };

  const tagsGrouped = await prisma.communityTag.groupBy({
    by: ['optionId'],
    where: whereClause,
    _count: { communityId: true },
  });

  // Get option labels and member counts
  const nodes: DrilldownNode[] = [];
  for (const group of tagsGrouped) {
    const option = await prisma.preferenceOption.findUnique({
      where: { id: group.optionId },
      select: { label: true },
    });

    // Calculate total members in communities with this option
    const communityIdsForOption = await prisma.communityTag.findMany({
      where: {
        ...whereClause,
        optionId: group.optionId,
      },
      select: { communityId: true },
    });
    const memberSum = await prisma.community.aggregate({
      where: { id: { in: communityIdsForOption.map(c => c.communityId) } },
      _sum: { memberCount: true },
    });

    nodes.push({
      optionId: group.optionId,
      label: option?.label || 'Unknown',
      communityCount: group._count.communityId,
      memberCount: memberSum._sum.memberCount || 0,
    });
  }

  // Sort by member count desc
  nodes.sort((a, b) => b.memberCount - a.memberCount);

  const totalCommunities = candidateIds ? candidateIds.length : await prisma.community.count();

  const result: DrilldownResult = {
    categoryId: currentCategory.id,
    categoryName: currentCategory.name,
    categorySlug: currentCategory.slug,
    depth,
    nodes,
    totalCommunities,
  };

  setCache(cacheKey, result, 30000);
  return result;
}

export async function getCommunitySettings(): Promise<{ autoDeleteEmpty: boolean }> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'community_auto_delete_empty' },
  });
  return { autoDeleteEmpty: setting ? setting.value === 'true' : true };
}

// ── Member Detail Query (for expandable community cards) ──────────

export interface CommunityMemberDetail {
  userId: string;
  username: string;
  name: string | null;
  questionnaire: {
    status: 'submitted' | 'draft' | 'not_started';
    answeredCount: number;
    totalCount: number;
  };
  virtualGroup: {
    groupId: string;
    groupName: string | null;
    groupStatus: string;
    memberCount: number;
  } | null;
  activityProgress: Array<{
    typeId: string;
    typeName: string;
    order: number;
    status: 'completed' | 'in_progress' | 'not_started';
  }>;
}

export interface CommunityMemberDetailsResult {
  members: CommunityMemberDetail[];
  activityTypes: Array<{ id: string; name: string; order: number }>;
}

export async function getCommunityMemberDetails(
  communityId: string,
): Promise<CommunityMemberDetailsResult> {
  // 1. Get community members with user data
  const communityMembers = await prisma.communityMember.findMany({
    where: { communityId },
    include: {
      user: { select: { id: true, username: true, name: true } },
    },
    orderBy: { joinedAt: 'asc' },
  });

  if (communityMembers.length === 0) {
    return { members: [], activityTypes: [] };
  }

  const userIds = communityMembers.map((m) => m.user.id);

  // 2. Parallel batch queries
  const [
    totalQuestionCount,
    activityTypes,
    snapshots,
    vgMemberships,
    allMemberships,
  ] = await Promise.all([
    // Total questions in active questionnaire version
    prisma.question.count({
      where: {
        dimension: {
          subTopic: { topic: { version: { isActive: true } } },
        },
      },
    }),
    // All enabled activity types
    prisma.activityType.findMany({
      where: { isEnabled: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, order: true },
    }),
    // User snapshots (both draft and submitted)
    prisma.responseSnapshot.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        isSnapshot: true,
        _count: { select: { answers: true } },
      },
    }),
    // Virtual group memberships for this community
    prisma.virtualGroupMember.findMany({
      where: {
        userId: { in: userIds },
        virtualGroup: { communityId },
      },
      include: {
        virtualGroup: {
          select: {
            id: true,
            name: true,
            status: true,
            _count: { select: { members: true } },
          },
        },
      },
    }),
    // Activity memberships (completed + in-progress)
    prisma.membership.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        completedAt: true,
        activity: { select: { typeId: true, status: true } },
      },
    }),
  ]);

  // 3. Build lookup maps
  // Questionnaire status per user
  const snapshotMap = new Map<string, { hasSubmitted: boolean; answeredCount: number }>();
  for (const snap of snapshots) {
    const existing = snapshotMap.get(snap.userId);
    if (snap.isSnapshot) {
      // Submitted snapshot — takes priority
      snapshotMap.set(snap.userId, {
        hasSubmitted: true,
        answeredCount: Math.max(snap._count.answers, existing?.answeredCount ?? 0),
      });
    } else if (!existing?.hasSubmitted) {
      // Draft — only use if no submitted snapshot yet
      snapshotMap.set(snap.userId, {
        hasSubmitted: false,
        answeredCount: Math.max(snap._count.answers, existing?.answeredCount ?? 0),
      });
    }
  }

  // Virtual group per user
  const vgMap = new Map<string, CommunityMemberDetail['virtualGroup']>();
  for (const vgm of vgMemberships) {
    vgMap.set(vgm.userId, {
      groupId: vgm.virtualGroup.id,
      groupName: vgm.virtualGroup.name,
      groupStatus: vgm.virtualGroup.status,
      memberCount: vgm.virtualGroup._count.members,
    });
  }

  // Activity progress per user: completed and in-progress type IDs
  const completedTypes = new Map<string, Set<string>>();
  const inProgressTypes = new Map<string, Set<string>>();
  for (const m of allMemberships) {
    if (m.completedAt) {
      if (!completedTypes.has(m.userId)) completedTypes.set(m.userId, new Set());
      completedTypes.get(m.userId)!.add(m.activity.typeId);
    } else if (['OPEN', 'FULL', 'SCHEDULED', 'IN_PROGRESS'].includes(m.activity.status)) {
      if (!inProgressTypes.has(m.userId)) inProgressTypes.set(m.userId, new Set());
      inProgressTypes.get(m.userId)!.add(m.activity.typeId);
    }
  }

  // 4. Assemble result
  const members: CommunityMemberDetail[] = communityMembers.map((cm) => {
    const uid = cm.user.id;
    const snapInfo = snapshotMap.get(uid);
    const userCompleted = completedTypes.get(uid) ?? new Set<string>();
    const userInProgress = inProgressTypes.get(uid) ?? new Set<string>();

    return {
      userId: uid,
      username: cm.user.username,
      name: cm.user.name,
      questionnaire: {
        status: snapInfo
          ? snapInfo.hasSubmitted
            ? 'submitted'
            : 'draft'
          : 'not_started',
        answeredCount: snapInfo?.answeredCount ?? 0,
        totalCount: totalQuestionCount,
      },
      virtualGroup: vgMap.get(uid) ?? null,
      activityProgress: activityTypes.map((at) => ({
        typeId: at.id,
        typeName: at.name,
        order: at.order,
        status: userCompleted.has(at.id)
          ? ('completed' as const)
          : userInProgress.has(at.id)
            ? ('in_progress' as const)
            : ('not_started' as const),
      })),
    };
  });

  return { members, activityTypes };
}

export async function getGroupingCategories(): Promise<GroupingCategory[]> {
  return prisma.preferenceCategory.findMany({
    where: { isGroupingBasis: true, isActive: true },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      order: true,
      inputType: true,
      isGroupingBasis: true,
      hierarchicalMatchLevel: true,
    },
  });
}
