import { prisma } from '@/lib/db';

export async function hasCompletedPreference(userId: string): Promise<boolean> {
  const pref = await prisma.userPreference.findUnique({
    where: { userId },
    select: { id: true },
  });
  return !!pref;
}

export async function getAllPreferenceCategories() {
  return prisma.preferenceCategory.findMany({
    where: { isActive: true },
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
      sliders: {
        orderBy: { order: 'asc' },
      },
    },
  });
}

export async function getUserPreferences(userId: string) {
  return prisma.userPreference.findUnique({
    where: { userId },
    include: {
      selections: {
        include: {
          option: {
            select: { id: true, label: true, value: true, categoryId: true },
          },
        },
      },
      sliderValues: {
        include: {
          slider: {
            select: { id: true, label: true, categoryId: true },
          },
        },
      },
    },
  });
}

export type PreferenceCategoryWithRelations = Awaited<ReturnType<typeof getAllPreferenceCategories>>[number];

// Admin: get all categories including inactive, with all options
export async function getAllPreferenceCategoriesAdmin() {
  return prisma.preferenceCategory.findMany({
    orderBy: { order: 'asc' },
    include: {
      options: {
        where: { parentId: null },
        orderBy: { order: 'asc' },
        include: {
          children: {
            orderBy: { order: 'asc' },
          },
          _count: {
            select: { selections: true },
          },
        },
      },
      sliders: {
        orderBy: { order: 'asc' },
      },
      _count: {
        select: { options: true },
      },
    },
  });
}

export type AdminPreferenceCategory = Awaited<ReturnType<typeof getAllPreferenceCategoriesAdmin>>[number];

/**
 * Get user's preference selections grouped by category slug.
 * Returns a map of categorySlug → selected option IDs.
 * Used by questionnaire to determine visible SubTopics and REPEAT instances.
 */
export async function getUserPreferencesByCategory(userId: string): Promise<Record<string, string[]>> {
  const prefs = await prisma.userPreference.findUnique({
    where: { userId },
    include: {
      selections: {
        include: {
          option: {
            select: {
              id: true,
              value: true,
              category: { select: { slug: true } },
            },
          },
        },
      },
    },
  });

  if (!prefs) return {};

  const result: Record<string, string[]> = {};
  for (const sel of prefs.selections) {
    const slug = sel.option.category.slug;
    if (!result[slug]) result[slug] = [];
    result[slug].push(sel.option.id);
  }
  return result;
}

/**
 * Get user's preference selections with labels, grouped by category slug.
 * Returns a map of categorySlug → { optionId, label }[].
 * Used by questionnaire UI for REPEAT tabs and CONTEXT labels.
 */
export async function getUserPreferenceLabels(userId: string): Promise<Record<string, { id: string; label: string; value: string }[]>> {
  const prefs = await prisma.userPreference.findUnique({
    where: { userId },
    include: {
      selections: {
        include: {
          option: {
            select: {
              id: true,
              label: true,
              value: true,
              category: { select: { slug: true } },
            },
          },
        },
      },
      sliderValues: {
        include: {
          slider: {
            select: {
              id: true,
              label: true,
              category: { select: { slug: true } },
            },
          },
        },
      },
    },
  });

  if (!prefs) return {};

  const result: Record<string, { id: string; label: string; value: string }[]> = {};
  for (const sel of prefs.selections) {
    const slug = sel.option.category.slug;
    if (!result[slug]) result[slug] = [];
    result[slug].push({ id: sel.option.id, label: sel.option.label, value: sel.option.value });
  }
  // For slider categories, add slider values as pseudo-selections
  for (const sv of prefs.sliderValues) {
    const slug = sv.slider.category.slug;
    if (!result[slug]) result[slug] = [];
    result[slug].push({ id: sv.slider.id, label: `${sv.slider.label}: ${sv.value}`, value: String(sv.value) });
  }
  return result;
}

/** Lightweight list for admin select dropdowns (id + name + slug) */
export async function getAllPreferenceCategoriesForSelect() {
  return prisma.preferenceCategory.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { order: 'asc' },
  });
}
