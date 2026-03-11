-- Backfill completedAt for memberships of activities that are already COMPLETED.
-- This ensures historical progression is not lost when upgrading to the completedAt-based unlock system.
UPDATE "memberships" m
SET "completedAt" = CURRENT_TIMESTAMP
FROM "activities" a
WHERE m."activityId" = a.id
  AND a.status = 'COMPLETED'
  AND m."completedAt" IS NULL;
