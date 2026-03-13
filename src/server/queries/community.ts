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
