import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { invalidateCache } from './communityCache';

// Types
interface TagCombo {
  categoryId: string;
  optionId: string;
  label: string;
}

// Generate deterministic fingerprint for a tag combination
function generateFingerprint(tags: { categoryId: string; optionId: string }[]): string {
  const sorted = [...tags].sort((a, b) => a.categoryId.localeCompare(b.categoryId));
  const key = sorted.map(t => `${t.categoryId}:${t.optionId}`).join('|');
  return createHash('sha256').update(key).digest('hex').slice(0, 32);
}

// Generate community name from tags (ordered by category order)
function generateCommunityName(tags: { label: string }[]): string {
  return tags.map(t => t.label).join(' \u00b7 ');
}

// Cartesian product of arrays
function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce<T[][]>(
    (acc, arr) => acc.flatMap(combo => arr.map(item => [...combo, item])),
    [[]]
  );
}

// Compute effective matching values for a user's selections in a category
function computeEffectiveValues(
  selectedOptionIds: Set<string>,
  category: {
    id: string;
    inputType: string;
    hierarchicalMatchLevel: string | null;
    options: Array<{
      id: string;
      label: string;
      parentId: string | null;
      isAutoSelected: boolean;
      children: Array<{ id: string; label: string; parentId: string | null; isAutoSelected: boolean }>;
    }>;
  }
): TagCombo[] {
  const results: TagCombo[] = [];

  if (category.inputType === 'SINGLE_SELECT' || category.inputType === 'MULTI_SELECT') {
    // For flat selects, just use selected options directly
    for (const opt of category.options) {
      if (selectedOptionIds.has(opt.id)) {
        results.push({ categoryId: category.id, optionId: opt.id, label: opt.label });
      }
    }
  } else if (category.inputType === 'HIERARCHICAL_MULTI') {
    const matchLevel = category.hierarchicalMatchLevel || 'PARENT';

    if (matchLevel === 'PARENT') {
      // Map leaf selections to their parent (or self if no parent)
      const seen = new Set<string>();
      for (const parentOpt of category.options) {
        // Check children first
        for (const child of parentOpt.children) {
          if (selectedOptionIds.has(child.id)) {
            if (parentOpt.isAutoSelected) {
              // Map to parent
              if (!seen.has(parentOpt.id)) {
                seen.add(parentOpt.id);
                results.push({ categoryId: category.id, optionId: parentOpt.id, label: parentOpt.label });
              }
            } else {
              // Parent is not auto-selected, use child directly
              if (!seen.has(child.id)) {
                seen.add(child.id);
                results.push({ categoryId: category.id, optionId: child.id, label: child.label });
              }
            }
          }
        }
        // Check parent itself (standalone options like 商人, 创业者)
        if (selectedOptionIds.has(parentOpt.id) && !parentOpt.isAutoSelected) {
          if (!seen.has(parentOpt.id)) {
            seen.add(parentOpt.id);
            results.push({ categoryId: category.id, optionId: parentOpt.id, label: parentOpt.label });
          }
        }
      }
    } else {
      // LEAF mode: use only leaf selections, skip auto-selected parents
      for (const parentOpt of category.options) {
        for (const child of parentOpt.children) {
          if (selectedOptionIds.has(child.id)) {
            results.push({ categoryId: category.id, optionId: child.id, label: child.label });
          }
        }
        // Standalone options (no children, not auto-selected)
        if (parentOpt.children.length === 0 && selectedOptionIds.has(parentOpt.id) && !parentOpt.isAutoSelected) {
          results.push({ categoryId: category.id, optionId: parentOpt.id, label: parentOpt.label });
        }
      }
    }
  }

  return results;
}

// Get the auto-delete-empty setting
async function getAutoDeleteEmpty(): Promise<boolean> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'community_auto_delete_empty' },
  });
  return setting ? setting.value === 'true' : true; // default true
}

// Main function: compute and write community memberships for a user
export async function computeUserCommunities(userId: string): Promise<void> {
  // 1. Get user's preference selections
  const userPref = await prisma.userPreference.findUnique({
    where: { userId },
    include: {
      selections: {
        include: {
          option: { select: { id: true, categoryId: true } },
        },
      },
    },
  });
  if (!userPref) return;

  // 2. Get grouping categories with their options
  const groupingCategories = await prisma.preferenceCategory.findMany({
    where: { isGroupingBasis: true, isActive: true },
    orderBy: { order: 'asc' },
    include: {
      options: {
        where: { isActive: true, parentId: null },
        orderBy: { order: 'asc' },
        include: {
          children: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  if (groupingCategories.length === 0) return;

  // 3. Build a set of user's selected option IDs per category
  const selectionsByCategory = new Map<string, Set<string>>();
  for (const sel of userPref.selections) {
    const catId = sel.option.categoryId;
    if (!selectionsByCategory.has(catId)) {
      selectionsByCategory.set(catId, new Set());
    }
    selectionsByCategory.get(catId)!.add(sel.option.id);
  }

  // 4. Compute effective values for each grouping category
  const effectiveValuesPerCategory: TagCombo[][] = [];
  for (const cat of groupingCategories) {
    const selected = selectionsByCategory.get(cat.id) || new Set<string>();
    const effective = computeEffectiveValues(selected, cat);
    if (effective.length === 0) {
      // User has no selection for this grouping category, skip community creation
      return;
    }
    effectiveValuesPerCategory.push(effective);
  }

  // 5. Compute cartesian product
  const combinations = cartesianProduct(effectiveValuesPerCategory);

  // 6. Get user's current community memberships (for cleanup)
  const existingMemberships = await prisma.communityMember.findMany({
    where: { userId },
    select: { communityId: true },
  });
  const oldCommunityIds = new Set(existingMemberships.map(m => m.communityId));

  // 7. For each combination, find or create community
  const newCommunityIds = new Set<string>();
  for (const combo of combinations) {
    const fingerprint = generateFingerprint(combo);
    const name = generateCommunityName(combo);

    // Upsert community
    let community = await prisma.community.findUnique({
      where: { fingerprint },
    });

    if (!community) {
      community = await prisma.community.create({
        data: {
          fingerprint,
          name,
          memberCount: 0,
          tags: {
            create: combo.map(tag => ({
              categoryId: tag.categoryId,
              optionId: tag.optionId,
            })),
          },
        },
      });
    }

    newCommunityIds.add(community.id);

    // Add member if not already
    if (!oldCommunityIds.has(community.id)) {
      await prisma.communityMember.create({
        data: { communityId: community.id, userId },
      }).catch(() => {
        // Ignore unique constraint violation (race condition)
      });
    }
  }

  // 8. Remove from old communities that user no longer belongs to
  const toRemove = [...oldCommunityIds].filter(id => !newCommunityIds.has(id));
  if (toRemove.length > 0) {
    await prisma.communityMember.deleteMany({
      where: { userId, communityId: { in: toRemove } },
    });
  }

  // 9. Update member counts for all affected communities
  const allAffected = new Set([...newCommunityIds, ...oldCommunityIds]);
  for (const communityId of allAffected) {
    const count = await prisma.communityMember.count({
      where: { communityId },
    });
    await prisma.community.update({
      where: { id: communityId },
      data: { memberCount: count },
    });
  }

  // 10. Clean up empty communities if setting enabled
  const autoDelete = await getAutoDeleteEmpty();
  if (autoDelete && toRemove.length > 0) {
    await prisma.community.deleteMany({
      where: { id: { in: toRemove }, memberCount: 0 },
    });
  }

  // 11. Invalidate cache
  invalidateCache('community:');
}

// Recompute all communities (admin action, after config change)
export async function recomputeAllCommunities(): Promise<{ processed: number; communities: number }> {
  // 1. Delete all existing communities and memberships
  await prisma.communityMember.deleteMany({});
  await prisma.communityTag.deleteMany({});
  await prisma.community.deleteMany({});

  // 2. Get all users who have completed preferences
  const users = await prisma.userPreference.findMany({
    select: { userId: true },
  });

  // 3. Recompute for each user
  let processed = 0;
  for (const { userId } of users) {
    await computeUserCommunities(userId);
    processed++;
  }

  // 4. Get final community count
  const communities = await prisma.community.count();

  // 5. Invalidate cache
  invalidateCache('community:');

  return { processed, communities };
}
