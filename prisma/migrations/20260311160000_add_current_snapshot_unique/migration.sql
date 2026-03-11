-- Enforce at most one editable (non-snapshot) record per user per version.
-- This prevents race conditions where concurrent requests create duplicate current records.
CREATE UNIQUE INDEX "response_snapshots_current_unique"
  ON "response_snapshots"("userId", "versionId")
  WHERE "isSnapshot" = false;
