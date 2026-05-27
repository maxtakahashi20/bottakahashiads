-- SaaS: licenças, tenants e isolamento multi-tenant
-- Cole no SQL Editor do Supabase (Run) ou: npx prisma db execute --file prisma/migrations/saas_licensing.sql
-- Depois: npx prisma generate

-- =============================================================================
-- 1) ENUMS (idempotente)
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LicenseStatus" AS ENUM ('PENDING', 'ACTIVATED', 'EXPIRED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LicenseDuration" AS ENUM ('MONTH_1', 'MONTH_3', 'YEAR_1');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2) TABELAS SaaS
-- =============================================================================
CREATE TABLE IF NOT EXISTS "Tenant" (
  "id"            TEXT PRIMARY KEY,
  "ownerUserId"   TEXT NOT NULL UNIQUE,
  "displayName"   TEXT,
  "status"        "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
  "isPlatform"    BOOLEAN NOT NULL DEFAULT false,
  "notifyExpiry"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "License" (
  "id"                TEXT PRIMARY KEY,
  "code"              TEXT NOT NULL UNIQUE,
  "duration"          "LicenseDuration" NOT NULL,
  "status"            "LicenseStatus" NOT NULL DEFAULT 'PENDING',
  "createdByUserId"   TEXT NOT NULL,
  "activatedByUserId" TEXT,
  "tenantId"          TEXT REFERENCES "Tenant"("id") ON DELETE SET NULL,
  "activatedAt"       TIMESTAMP(3),
  "revokedAt"         TIMESTAMP(3),
  "revokedByUserId"   TEXT,
  "note"              TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Subscription" (
  "id"        TEXT PRIMARY KEY,
  "tenantId"  TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "licenseId" TEXT NOT NULL REFERENCES "License"("id") ON DELETE RESTRICT,
  "startsAt"  TIMESTAMP(3) NOT NULL,
  "endsAt"    TIMESTAMP(3) NOT NULL,
  "status"    "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "TenantSettings" (
  "id"               TEXT PRIMARY KEY,
  "tenantId"         TEXT NOT NULL UNIQUE REFERENCES "Tenant"("id") ON DELETE CASCADE,
  "botRunning"       BOOLEAN NOT NULL DEFAULT true,
  "globalMessage"    TEXT,
  "globalBannerUrl"  TEXT,
  "globalInviteUrl"  TEXT,
  "messagesPerCycle" INTEGER NOT NULL DEFAULT 1,
  "delayMsgMinSec"   DOUBLE PRECISION NOT NULL DEFAULT 2,
  "delayMsgMaxSec"   DOUBLE PRECISION NOT NULL DEFAULT 5,
  "delayGuildMinSec" DOUBLE PRECISION NOT NULL DEFAULT 15,
  "delayGuildMaxSec" DOUBLE PRECISION NOT NULL DEFAULT 35,
  "minCycleMinutes"  DOUBLE PRECISION NOT NULL DEFAULT 50,
  "totalCycles"      INTEGER NOT NULL DEFAULT 0,
  "scheduledAt"      TIMESTAMP(3),
  "lastSendAt"       TIMESTAMP(3),
  "networkEnabled"   BOOLEAN NOT NULL DEFAULT true,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"        TEXT PRIMARY KEY,
  "tenantId"  TEXT REFERENCES "Tenant"("id") ON DELETE SET NULL,
  "actorId"   TEXT,
  "action"    TEXT NOT NULL,
  "target"    TEXT,
  "message"   TEXT,
  "meta"      JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "License_status_idx" ON "License" ("status");
CREATE INDEX IF NOT EXISTS "Subscription_tenantId_status_idx" ON "Subscription" ("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Subscription_endsAt_idx" ON "Subscription" ("endsAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog" ("action", "createdAt" DESC);

-- =============================================================================
-- 3) TENANT PLATAFORMA (dados legados Takahashi Ads)
-- =============================================================================
INSERT INTO "Tenant" ("id", "ownerUserId", "displayName", "status", "isPlatform", "notifyExpiry", "createdAt", "updatedAt")
VALUES ('platform', 'platform-system', 'Takahashi Ads (Plataforma)', 'ACTIVE', true, false, NOW(), NOW())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "TenantSettings" (
  "id", "tenantId", "botRunning", "messagesPerCycle",
  "delayMsgMinSec", "delayMsgMaxSec", "delayGuildMinSec", "delayGuildMaxSec",
  "minCycleMinutes", "totalCycles", "networkEnabled", "updatedAt"
)
VALUES (
  'cfg-platform', 'platform', true, 1,
  2, 5, 15, 35,
  50, 0, true, NOW()
)
ON CONFLICT ("tenantId") DO NOTHING;

-- =============================================================================
-- 4) COLUNAS tenantId (tabelas existentes)
-- =============================================================================
ALTER TABLE "GuildSettings" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "UserToken" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "Advertisement" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "Cooldown" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "Blacklist" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "DivulgationRun" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "Partnership" ADD COLUMN IF NOT EXISTS "tenantId" TEXT NOT NULL DEFAULT 'platform';
ALTER TABLE "Analytics" ADD COLUMN IF NOT EXISTS "tenantId" TEXT DEFAULT 'platform';

UPDATE "GuildSettings" SET "tenantId" = 'platform' WHERE "tenantId" IS NULL OR "tenantId" = '';
UPDATE "UserToken" SET "tenantId" = 'platform' WHERE "tenantId" IS NULL OR "tenantId" = '';
UPDATE "Advertisement" SET "tenantId" = 'platform' WHERE "tenantId" IS NULL OR "tenantId" = '';
UPDATE "Cooldown" SET "tenantId" = 'platform' WHERE "tenantId" IS NULL OR "tenantId" = '';
UPDATE "Blacklist" SET "tenantId" = 'platform' WHERE "tenantId" IS NULL OR "tenantId" = '';
UPDATE "DivulgationRun" SET "tenantId" = 'platform' WHERE "tenantId" IS NULL OR "tenantId" = '';
UPDATE "Partnership" SET "tenantId" = 'platform' WHERE "tenantId" IS NULL OR "tenantId" = '';
UPDATE "Analytics" SET "tenantId" = 'platform' WHERE "tenantId" IS NULL;

-- =============================================================================
-- 5) ÍNDICES / UNIQUE multi-tenant
--    Partnership referencia GuildSettings(guildId) — FKs precisam ser recriadas
-- =============================================================================

-- 5a) Remove FKs antigas de Partnership (dependem de GuildSettings_guildId_key)
ALTER TABLE "Partnership" DROP CONSTRAINT IF EXISTS "Partnership_guildAId_fkey";
ALTER TABLE "Partnership" DROP CONSTRAINT IF EXISTS "Partnership_guildBId_fkey";
ALTER TABLE "Partnership" DROP CONSTRAINT IF EXISTS "Partnership_unique_pair";

-- 5b) Agora pode trocar unique de GuildSettings
ALTER TABLE "GuildSettings" DROP CONSTRAINT IF EXISTS "GuildSettings_guildId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "GuildSettings_tenantId_guildId_key"
  ON "GuildSettings" ("tenantId", "guildId");

-- 5c) Recria FKs de Partnership com (tenantId + guildId)
ALTER TABLE "Partnership" DROP CONSTRAINT IF EXISTS "Partnership_guildAId_fkey";
ALTER TABLE "Partnership" DROP CONSTRAINT IF EXISTS "Partnership_guildBId_fkey";

ALTER TABLE "Partnership"
  ADD CONSTRAINT "Partnership_guildAId_fkey"
  FOREIGN KEY ("tenantId", "guildAId")
  REFERENCES "GuildSettings" ("tenantId", "guildId")
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "Partnership"
  ADD CONSTRAINT "Partnership_guildBId_fkey"
  FOREIGN KEY ("tenantId", "guildBId")
  REFERENCES "GuildSettings" ("tenantId", "guildId")
  ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE UNIQUE INDEX IF NOT EXISTS "Partnership_unique_tenant_pair"
  ON "Partnership" ("tenantId", "guildAId", "guildBId");

-- 5d) Demais tabelas
ALTER TABLE "UserToken" DROP CONSTRAINT IF EXISTS "UserToken_slot_key";
CREATE UNIQUE INDEX IF NOT EXISTS "UserToken_tenantId_slot_key"
  ON "UserToken" ("tenantId", "slot");

ALTER TABLE "Cooldown" DROP CONSTRAINT IF EXISTS "Cooldown_unique_scope_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Cooldown_unique_tenant_scope_key"
  ON "Cooldown" ("tenantId", "scope", "key");

ALTER TABLE "Blacklist" DROP CONSTRAINT IF EXISTS "Blacklist_unique_type_target";
CREATE UNIQUE INDEX IF NOT EXISTS "Blacklist_unique_tenant_type_target"
  ON "Blacklist" ("tenantId", "type", "targetId");

CREATE UNIQUE INDEX IF NOT EXISTS "Analytics_tenantId_key"
  ON "Analytics" ("tenantId");

CREATE INDEX IF NOT EXISTS "GuildSettings_tenantId_idx" ON "GuildSettings" ("tenantId");
CREATE INDEX IF NOT EXISTS "UserToken_tenantId_active_idx" ON "UserToken" ("tenantId", "active");
CREATE INDEX IF NOT EXISTS "Advertisement_tenantId_guildId_createdAt_idx"
  ON "Advertisement" ("tenantId", "guildId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DivulgationRun_tenantId_status_startedAt_idx"
  ON "DivulgationRun" ("tenantId", "status", "startedAt" DESC);
