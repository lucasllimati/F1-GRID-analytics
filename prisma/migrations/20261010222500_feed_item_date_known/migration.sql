-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ArticleSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "feedItemId" TEXT,
    "publisher" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedAt" DATETIME NOT NULL,
    "publishedAtKnown" BOOLEAN NOT NULL DEFAULT true,
    "accessedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArticleSource_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ArticleSource" ("accessedAt", "articleId", "feedItemId", "id", "publishedAt", "publisher", "sourceId", "title", "url") SELECT "accessedAt", "articleId", "feedItemId", "id", "publishedAt", "publisher", "sourceId", "title", "url" FROM "ArticleSource";
DROP TABLE "ArticleSource";
ALTER TABLE "new_ArticleSource" RENAME TO "ArticleSource";
CREATE INDEX "ArticleSource_articleId_idx" ON "ArticleSource"("articleId");
CREATE TABLE "new_FeedItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "guid" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "publishedAt" DATETIME NOT NULL,
    "publishedAtKnown" BOOLEAN NOT NULL DEFAULT true,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidenceText" TEXT,
    "evidenceFetchedAt" DATETIME,
    "excluded" BOOLEAN NOT NULL DEFAULT false,
    "excludeReason" TEXT,
    "storyId" TEXT,
    CONSTRAINT "FeedItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NewsSource" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FeedItem_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FeedItem" ("evidenceFetchedAt", "evidenceText", "excludeReason", "excluded", "fetchedAt", "guid", "id", "publishedAt", "sourceId", "storyId", "summary", "title", "url") SELECT "evidenceFetchedAt", "evidenceText", "excludeReason", "excluded", "fetchedAt", "guid", "id", "publishedAt", "sourceId", "storyId", "summary", "title", "url" FROM "FeedItem";
DROP TABLE "FeedItem";
ALTER TABLE "new_FeedItem" RENAME TO "FeedItem";
CREATE INDEX "FeedItem_publishedAt_idx" ON "FeedItem"("publishedAt");
CREATE INDEX "FeedItem_storyId_idx" ON "FeedItem"("storyId");
CREATE UNIQUE INDEX "FeedItem_sourceId_guid_key" ON "FeedItem"("sourceId", "guid");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
