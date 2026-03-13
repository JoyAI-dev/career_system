/**
 * Activity Scheduling Service
 *
 * Auto-schedules activities based on configuration:
 * - When a group is formed (first activity: schedule for next day)
 * - When previous activity completes (schedule next with intervalHours gap)
 * - Time rules: morning cutoff, evening cutoff, suggested time slots
 */

import { prisma } from '@/lib/db';
import type { PrismaTransactionClient } from './virtualGroup';

/**
 * Get the scheduling configuration (singleton).
 */
export async function getSchedulingConfig() {
  return prisma.schedulingConfig.findUnique({ where: { id: 'default' } });
}

/**
 * Calculate the scheduled time for an activity based on:
 * - When the trigger event occurred (group filled / previous activity completed)
 * - The activity type's intervalHours
 * - The scheduling config's cutoff rules
 *
 * Logic:
 * - If trigger is before morning cutoff: apply morningDelayHours
 * - If trigger is after evening cutoff: apply eveningDelayHours
 * - Otherwise: use the activity type's intervalHours
 * - Final time is set to defaultActivityTime on the resulting day
 * - If that time is already in the past, move to next day
 */
export async function calculateScheduledTime(
  triggerTime: Date,
  intervalHours: number,
): Promise<Date> {
  const config = await getSchedulingConfig();
  if (!config) {
    // Fallback: just add intervalHours
    return new Date(triggerTime.getTime() + intervalHours * 60 * 60 * 1000);
  }

  // Parse cutoffs
  const [morningH, morningM] = config.morningCutoff.split(':').map(Number);
  const [eveningH, eveningM] = config.eveningCutoff.split(':').map(Number);
  const [defaultH, defaultM] = config.defaultActivityTime.split(':').map(Number);

  const triggerHour = triggerTime.getHours();
  const triggerMinute = triggerTime.getMinutes();
  const triggerTimeValue = triggerHour * 60 + triggerMinute;
  const morningCutoffValue = morningH * 60 + morningM;
  const eveningCutoffValue = eveningH * 60 + eveningM;

  let delayHours: number;

  if (triggerTimeValue < morningCutoffValue) {
    // Before morning cutoff: use morning delay
    delayHours = config.morningDelayHours;
  } else if (triggerTimeValue >= eveningCutoffValue) {
    // After evening cutoff: use evening delay
    delayHours = config.eveningDelayHours;
  } else {
    // Between cutoffs: use intervalHours
    delayHours = intervalHours;
  }

  // Calculate base date by adding delay
  const scheduledDate = new Date(triggerTime.getTime() + delayHours * 60 * 60 * 1000);

  // Set to default activity time
  scheduledDate.setHours(defaultH, defaultM, 0, 0);

  // If scheduled time is in the past (within same day), move to next day
  if (scheduledDate <= triggerTime) {
    scheduledDate.setDate(scheduledDate.getDate() + 1);
  }

  return scheduledDate;
}

/**
 * Schedule an activity: set autoScheduledAt and scheduledAt, update status to SCHEDULED.
 *
 * @param tx Optional transaction client for running within an existing transaction.
 */
export async function scheduleActivity(
  activityId: string,
  scheduledTime: Date,
  tx?: PrismaTransactionClient,
): Promise<void> {
  const db = tx ?? prisma;
  await db.activity.update({
    where: { id: activityId },
    data: {
      autoScheduledAt: scheduledTime,
      scheduledAt: scheduledTime,
      status: 'SCHEDULED',
    },
  });
}

/**
 * Schedule all subsequent activities for a virtual group.
 * Called when the first activity (roundtable) time is set.
 * This is informational only -- actual scheduling happens when activities are created.
 *
 * Returns an array of { typeId, plannedTime } for reference.
 */
export async function scheduleSubsequentActivities(
  virtualGroupId: string,
  firstActivityTime: Date,
): Promise<Array<{ typeId: string; plannedTime: Date }>> {
  // Get all activity types in order
  const types = await prisma.activityType.findMany({
    where: { isEnabled: true },
    orderBy: { order: 'asc' },
    select: { id: true, order: true, intervalHours: true },
  });

  // Get existing activities for this virtual group
  const existingActivities = await prisma.activity.findMany({
    where: { virtualGroupId },
    select: { typeId: true, id: true },
  });
  const existingTypeIds = new Set(existingActivities.map((a) => a.typeId));

  const planned: Array<{ typeId: string; plannedTime: Date }> = [];
  let previousTime = firstActivityTime;

  for (const type of types) {
    if (existingTypeIds.has(type.id)) {
      // Already has an activity for this type; use the first activity's time as base
      const existing = existingActivities.find((a) => a.typeId === type.id);
      if (existing) {
        const existingActivity = await prisma.activity.findUnique({
          where: { id: existing.id },
          select: { scheduledAt: true },
        });
        if (existingActivity?.scheduledAt) {
          previousTime = existingActivity.scheduledAt;
        }
      }
      continue;
    }

    // Calculate planned time for future activities
    const plannedTime = await calculateScheduledTime(previousTime, type.intervalHours);
    planned.push({ typeId: type.id, plannedTime });
    previousTime = plannedTime;
  }

  return planned;
}
