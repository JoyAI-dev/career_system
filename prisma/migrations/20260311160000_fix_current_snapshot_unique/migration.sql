-- Dedup: For each user with multiple isSnapshot=false rows, keep only the newest
-- (by completedAt DESC), and convert the rest to snapshots (isSnapshot=true).
UPDATE "response_snapshots"
SET "isSnapshot" = true, "snapshotLabel" = 'auto-converted'
WHERE "isSnapshot" = false
  AND "id" NOT IN (
    SELECT DISTINCT ON ("userId") "id"
    FROM "response_snapshots"
    WHERE "isSnapshot" = false
    ORDER BY "userId", "completedAt" DESC
  );

-- CreateIndex: One current (editable) record per user
CREATE UNIQUE INDEX "response_snapshots_userId_current_unique"
  ON "response_snapshots" ("userId")
  WHERE "isSnapshot" = false;
