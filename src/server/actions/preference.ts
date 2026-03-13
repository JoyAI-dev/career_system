'use server';

import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAllPreferenceCategories } from '@/server/queries/preference';
import { computeUserCommunities } from '@/server/services/community';

export type ActionState = {
  errors?: { [key: string]: string[] };
  success?: boolean;
};

// ── User: Submit Preferences ────────────────────────────────────────

const selectionSchema = z.object({
  optionIds: z.array(z.string()),
});

const sliderValueSchema = z.object({
  sliderId: z.string(),
  value: z.number().int(),
});

const submitSchema = z.object({
  selections: z.record(z.string(), selectionSchema),
  sliderValues: z.array(sliderValueSchema),
});

export type PreferenceSubmission = z.infer<typeof submitSchema>;

export async function submitPreferences(
  data: PreferenceSubmission,
): Promise<ActionState> {
  const session = await requireAuth();
  const userId = session.user.id;

  // Check if already submitted
  const existing = await prisma.userPreference.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) {
    redirect('/questionnaire');
  }

  // Validate structure
  const parsed = submitSchema.safeParse(data);
  if (!parsed.success) {
    return { errors: { _form: ['Invalid submission data'] } };
  }

  // Load categories for validation
  const categories = await getAllPreferenceCategories();

  // Validate all categories are covered
  const allOptionIds: string[] = [];
  for (const cat of categories) {
    if (cat.inputType === 'SLIDER') {
      // For slider categories, check slider values exist
      for (const slider of cat.sliders) {
        const sv = parsed.data.sliderValues.find((v) => v.sliderId === slider.id);
        if (!sv) {
          return {
            errors: { [cat.slug]: [`${cat.name} is required`] },
          };
        }
        if (sv.value < slider.minValue || sv.value > slider.maxValue) {
          return {
            errors: { [cat.slug]: [`Value must be between ${slider.minValue} and ${slider.maxValue}`] },
          };
        }
      }
    } else {
      // For select categories, check options exist
      const catSelection = parsed.data.selections[cat.id];
      if (!catSelection || catSelection.optionIds.length === 0) {
        return {
          errors: { [cat.slug]: [`${cat.name} is required`] },
        };
      }

      // For SINGLE_SELECT, only one option allowed
      if (cat.inputType === 'SINGLE_SELECT' && catSelection.optionIds.length > 1) {
        return {
          errors: { [cat.slug]: [`${cat.name} allows only one selection`] },
        };
      }

      // Validate option IDs belong to this category
      const validOptionIds = new Set<string>();
      for (const opt of cat.options) {
        validOptionIds.add(opt.id);
        for (const child of opt.children) {
          validOptionIds.add(child.id);
        }
      }
      for (const optId of catSelection.optionIds) {
        if (!validOptionIds.has(optId)) {
          return {
            errors: { [cat.slug]: ['Invalid option selected'] },
          };
        }
      }

      allOptionIds.push(...catSelection.optionIds);
    }
  }

  // Create in transaction
  await prisma.$transaction(async (tx) => {
    const pref = await tx.userPreference.create({
      data: {
        userId,
        completedAt: new Date(),
      },
    });

    // Bulk insert selections
    if (allOptionIds.length > 0) {
      await tx.userPreferenceSelection.createMany({
        data: allOptionIds.map((optionId) => ({
          userPreferenceId: pref.id,
          optionId,
        })),
      });
    }

    // Bulk insert slider values
    if (parsed.data.sliderValues.length > 0) {
      await tx.userPreferenceSliderValue.createMany({
        data: parsed.data.sliderValues.map((sv) => ({
          userPreferenceId: pref.id,
          sliderId: sv.sliderId,
          value: sv.value,
        })),
      });
    }
  });

  // Compute community memberships based on preferences
  await computeUserCommunities(userId);

  redirect('/questionnaire');
}

// ── Admin: Category CRUD ────────────────────────────────────────────

export async function createPreferenceOption(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const categoryId = formData.get('categoryId') as string;
  const label = formData.get('label') as string;
  const value = formData.get('value') as string;
  const order = parseInt(formData.get('order') as string, 10);
  const parentId = (formData.get('parentId') as string) || null;

  if (!categoryId || !label || !value || isNaN(order)) {
    return { errors: { _form: ['All fields are required'] } };
  }

  // Check for duplicate value within category
  const existing = await prisma.preferenceOption.findFirst({
    where: { categoryId, value },
  });
  if (existing) {
    return { errors: { value: ['This value already exists in this category'] } };
  }

  await prisma.preferenceOption.create({
    data: { categoryId, label, value, order, parentId },
  });

  revalidatePath('/admin/preferences');
  return { success: true };
}

export async function updatePreferenceOption(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = formData.get('id') as string;
  const label = formData.get('label') as string;
  const value = formData.get('value') as string;
  const order = parseInt(formData.get('order') as string, 10);

  if (!id || !label || !value || isNaN(order)) {
    return { errors: { _form: ['All fields are required'] } };
  }

  await prisma.preferenceOption.update({
    where: { id },
    data: { label, value, order },
  });

  revalidatePath('/admin/preferences');
  return { success: true };
}

export async function deletePreferenceOption(id: string): Promise<ActionState> {
  await requireAdmin();

  // Check if option is used by any user
  const count = await prisma.userPreferenceSelection.count({
    where: { optionId: id },
  });
  if (count > 0) {
    return {
      errors: { _form: [`Cannot delete: ${count} user(s) have selected this option`] },
    };
  }

  await prisma.preferenceOption.delete({ where: { id } });
  revalidatePath('/admin/preferences');
  return { success: true };
}

export async function updatePreferenceCategory(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();

  const id = formData.get('id') as string;
  const name = formData.get('name') as string;
  const icon = formData.get('icon') as string;
  const isActive = formData.get('isActive') === 'true';
  const isGroupingBasis = formData.get('isGroupingBasis') === 'true';

  if (!id || !name) {
    return { errors: { _form: ['Name is required'] } };
  }

  await prisma.preferenceCategory.update({
    where: { id },
    data: { name, icon: icon || undefined, isActive, isGroupingBasis },
  });

  revalidatePath('/admin/preferences');
  return { success: true };
}
