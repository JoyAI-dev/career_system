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
