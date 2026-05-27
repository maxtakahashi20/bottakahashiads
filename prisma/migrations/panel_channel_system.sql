-- Takahashi Network — painel + canais (execute no Supabase)

ALTER TABLE "GuildSettings" ADD COLUMN IF NOT EXISTS "delayMinutes" INTEGER NOT NULL DEFAULT 120;
ALTER TABLE "GuildSettings" ADD COLUMN IF NOT EXISTS "customMessage" TEXT;
ALTER TABLE "GuildSettings" ADD COLUMN IF NOT EXISTS "nextSendAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "SystemConfig" (
  "id" TEXT PRIMARY KEY DEFAULT 'global',
  "botRunning" BOOLEAN NOT NULL DEFAULT true,
  "globalMessage" TEXT,
  "globalBannerUrl" TEXT,
  "globalInviteUrl" TEXT,
  "messagesPerCycle" INTEGER NOT NULL DEFAULT 1,
  "delayMsgMinSec" DOUBLE PRECISION NOT NULL DEFAULT 2,
  "delayMsgMaxSec" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "delayGuildMinSec" DOUBLE PRECISION NOT NULL DEFAULT 15,
  "delayGuildMaxSec" DOUBLE PRECISION NOT NULL DEFAULT 35,
  "minCycleMinutes" DOUBLE PRECISION NOT NULL DEFAULT 5,
  "totalCycles" INTEGER NOT NULL DEFAULT 0,
  "scheduledAt" TIMESTAMP(3),
  "lastSendAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "DivulgationRun" (
  "id" TEXT PRIMARY KEY,
  "number" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'running',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "messagesSent" INTEGER NOT NULL DEFAULT 0,
  "cyclesDone" INTEGER NOT NULL DEFAULT 0,
  "errorsCount" INTEGER NOT NULL DEFAULT 0,
  "advertisementId" TEXT
);

CREATE INDEX IF NOT EXISTS "DivulgationRun_status_startedAt_idx" ON "DivulgationRun" ("status", "startedAt" DESC);

INSERT INTO "SystemConfig" ("id") VALUES ('global') ON CONFLICT ("id") DO NOTHING;
