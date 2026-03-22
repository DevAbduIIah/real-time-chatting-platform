-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("conversationId", "userId"),
    CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'direct',
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "user1LastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user2LastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user1Id" TEXT,
    "user2Id" TEXT,
    CONSTRAINT "Conversation_user1Id_fkey" FOREIGN KEY ("user1Id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Conversation_user2Id_fkey" FOREIGN KEY ("user2Id") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Conversation" ("createdAt", "id", "updatedAt", "user1Id", "user1LastReadAt", "user2Id", "user2LastReadAt")
SELECT "createdAt", "id", "updatedAt", "user1Id", "user1LastReadAt", "user2Id", "user2LastReadAt" FROM "Conversation";
DROP TABLE "Conversation";
ALTER TABLE "new_Conversation" RENAME TO "Conversation";
CREATE INDEX "Conversation_type_idx" ON "Conversation"("type");
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");
CREATE UNIQUE INDEX "Conversation_user1Id_user2Id_key" ON "Conversation"("user1Id", "user2Id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Backfill participant rows for existing direct conversations
INSERT INTO "ConversationParticipant" ("conversationId", "userId", "joinedAt", "lastReadAt")
SELECT "id", "user1Id", "createdAt", "user1LastReadAt"
FROM "Conversation"
WHERE "user1Id" IS NOT NULL;

INSERT INTO "ConversationParticipant" ("conversationId", "userId", "joinedAt", "lastReadAt")
SELECT "id", "user2Id", "createdAt", "user2LastReadAt"
FROM "Conversation"
WHERE "user2Id" IS NOT NULL;

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_lastReadAt_idx" ON "ConversationParticipant"("conversationId", "lastReadAt");
