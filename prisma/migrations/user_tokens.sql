CREATE TABLE IF NOT EXISTS "UserToken" (
  "id" TEXT PRIMARY KEY,
  "slot" INTEGER NOT NULL UNIQUE,
  "ownerId" TEXT NOT NULL,
  "discordUserId" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "tokenEnc" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastError" TEXT,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "UserToken_active_idx" ON "UserToken" ("active");
CREATE INDEX IF NOT EXISTS "UserToken_ownerId_idx" ON "UserToken" ("ownerId");
