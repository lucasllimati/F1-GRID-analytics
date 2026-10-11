-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IngestionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kind" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stats" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT,
    "progress" TEXT NOT NULL DEFAULT '{}',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
);
INSERT INTO "new_IngestionRun" ("error", "finishedAt", "id", "kind", "startedAt", "stats", "status", "trigger") SELECT "error", "finishedAt", "id", "kind", "startedAt", "stats", "status", "trigger" FROM "IngestionRun";
DROP TABLE "IngestionRun";
ALTER TABLE "new_IngestionRun" RENAME TO "IngestionRun";
CREATE INDEX "IngestionRun_startedAt_idx" ON "IngestionRun"("startedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
