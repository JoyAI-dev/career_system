'use server';

/**
 * Scheduling Config Server Actions (Admin only)
 */

import { requireAdmin, requireAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { getSchedulingConfig } from '@/server/services/activityScheduling';
import { prisma } from '@/lib/db';

/** Get current scheduling configuration */
export async function getSchedulingConfiguration() {
  await requireAuth();
  return getSchedulingConfig();
}

/** Admin: Update scheduling configuration */
export async function updateSchedulingConfig(data: {
  morningCutoff?: string;
  eveningCutoff?: string;
  morningDelayHours?: number;
  eveningDelayHours?: number;
  defaultActivityTime?: string;
  suggestedMorningStart?: string;
  suggestedMorningEnd?: string;
  suggestedAfternoonStart?: string;
  suggestedAfternoonEnd?: string;
}) {
  await requireAdmin();

  await prisma.schedulingConfig.upsert({
    where: { id: 'default' },
    update: data,
    create: { id: 'default', ...data },
  });

  revalidatePath('/admin/communities');
  return { success: true };
}
