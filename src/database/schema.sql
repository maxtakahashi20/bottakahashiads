-- =============================================================================
-- Takahashi Network — schema.sql (PostgreSQL)
-- Bot de divulgação automática e parcerias entre servidores Discord
-- =============================================================================
-- Uso:
--   psql -U postgres -d takahashi_network -f src/database/schema.sql
--
-- Observação:
--   O Prisma também gerencia migrations via prisma/schema.prisma.
--   Este arquivo serve para setup manual, deploy e documentação do banco.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Extensões
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE "AdCategory" AS ENUM (
    'FIVEM',
    'ROLEPLAY',
    'GAMING',
    'STORE',
    'COMMUNITY',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PremiumPlan" AS ENUM (
    'NONE',
    'STARTER',
    'PRO',
    'ENTERPRISE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Função: atualizar updatedAt automaticamente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- GuildSettings — configurações por servidor
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "GuildSettings" (
  "id"                TEXT PRIMARY KEY,
  "guildId"           TEXT NOT NULL UNIQUE,
  "adsEnabled"        BOOLEAN NOT NULL DEFAULT FALSE,
  "adsChannelId"      TEXT,
  "userCooldownSec"   INTEGER NOT NULL DEFAULT 900,
  "guildCooldownSec"  INTEGER NOT NULL DEFAULT 900,
  "allowedCategories" "AdCategory"[] NOT NULL DEFAULT ARRAY[]::"AdCategory"[],
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE "GuildSettings" IS 'Configurações de anúncios por servidor Discord';
COMMENT ON COLUMN "GuildSettings"."guildId" IS 'ID do servidor Discord';
COMMENT ON COLUMN "GuildSettings"."adsChannelId" IS 'Canal onde anúncios parceiros são recebidos';
COMMENT ON COLUMN "GuildSettings"."allowedCategories" IS 'Categorias de anúncio permitidas neste servidor';

DROP TRIGGER IF EXISTS trg_guildsettings_updated_at ON "GuildSettings";
CREATE TRIGGER trg_guildsettings_updated_at
  BEFORE UPDATE ON "GuildSettings"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Partnership — parcerias entre servidores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Partnership" (
  "id"        TEXT PRIMARY KEY,
  "guildAId"  TEXT NOT NULL,
  "guildBId"  TEXT NOT NULL,
  "active"    BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Partnership_guildAId_fkey"
    FOREIGN KEY ("guildAId") REFERENCES "GuildSettings" ("guildId") ON DELETE CASCADE,
  CONSTRAINT "Partnership_guildBId_fkey"
    FOREIGN KEY ("guildBId") REFERENCES "GuildSettings" ("guildId") ON DELETE CASCADE,
  CONSTRAINT "Partnership_unique_pair" UNIQUE ("guildAId", "guildBId")
);

CREATE INDEX IF NOT EXISTS "Partnership_active_idx" ON "Partnership" ("active");
CREATE INDEX IF NOT EXISTS "Partnership_guildAId_idx" ON "Partnership" ("guildAId");
CREATE INDEX IF NOT EXISTS "Partnership_guildBId_idx" ON "Partnership" ("guildBId");

COMMENT ON TABLE "Partnership" IS 'Parcerias ativas entre servidores da rede';

-- ---------------------------------------------------------------------------
-- Advertisement — anúncios criados
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Advertisement" (
  "id"          TEXT PRIMARY KEY,
  "guildId"     TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "bannerUrl"   TEXT,
  "inviteUrl"   TEXT NOT NULL,
  "category"    "AdCategory" NOT NULL,
  "sanitized"   BOOLEAN NOT NULL DEFAULT TRUE,
  "sentCount"   INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Advertisement_guildId_createdAt_idx"
  ON "Advertisement" ("guildId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Advertisement_category_createdAt_idx"
  ON "Advertisement" ("category", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Advertisement_userId_idx"
  ON "Advertisement" ("userId");

COMMENT ON TABLE "Advertisement" IS 'Anúncios criados pelos administradores dos servidores';

-- ---------------------------------------------------------------------------
-- AdDelivery — entregas por servidor/canal
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "AdDelivery" (
  "id"              TEXT PRIMARY KEY,
  "advertisementId" TEXT NOT NULL,
  "targetGuildId"   TEXT NOT NULL,
  "targetChannelId" TEXT NOT NULL,
  "status"          TEXT NOT NULL, -- sent | failed
  "error"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AdDelivery_advertisementId_fkey"
    FOREIGN KEY ("advertisementId") REFERENCES "Advertisement" ("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "AdDelivery_advertisementId_idx"
  ON "AdDelivery" ("advertisementId");

CREATE INDEX IF NOT EXISTS "AdDelivery_targetGuildId_createdAt_idx"
  ON "AdDelivery" ("targetGuildId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "AdDelivery_status_idx"
  ON "AdDelivery" ("status");

COMMENT ON TABLE "AdDelivery" IS 'Registro de cada envio de anúncio para um servidor parceiro';

-- ---------------------------------------------------------------------------
-- Cooldown — anti-spam (usuário e servidor)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Cooldown" (
  "id"        TEXT PRIMARY KEY,
  "scope"     TEXT NOT NULL, -- user | guild
  "key"       TEXT NOT NULL, -- userId ou guildId
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Cooldown_unique_scope_key" UNIQUE ("scope", "key")
);

CREATE INDEX IF NOT EXISTS "Cooldown_expiresAt_idx"
  ON "Cooldown" ("expiresAt");

CREATE INDEX IF NOT EXISTS "Cooldown_scope_key_idx"
  ON "Cooldown" ("scope", "key");

COMMENT ON TABLE "Cooldown" IS 'Controle de cooldown por usuário ou servidor';

DROP TRIGGER IF EXISTS trg_cooldown_updated_at ON "Cooldown";
CREATE TRIGGER trg_cooldown_updated_at
  BEFORE UPDATE ON "Cooldown"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Analytics — métricas globais
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Analytics" (
  "id"              TEXT PRIMARY KEY,
  "totalAds"        INTEGER NOT NULL DEFAULT 0,
  "totalDeliveries" INTEGER NOT NULL DEFAULT 0,
  "totalFailures"   INTEGER NOT NULL DEFAULT 0,
  "connectedGuilds" INTEGER NOT NULL DEFAULT 0,
  "networkEnabled"  BOOLEAN NOT NULL DEFAULT true,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE "Analytics" IS 'Métricas globais da Takahashi Network';

DROP TRIGGER IF EXISTS trg_analytics_updated_at ON "Analytics";
CREATE TRIGGER trg_analytics_updated_at
  BEFORE UPDATE ON "Analytics"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- Blacklist — usuários e servidores bloqueados
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Blacklist" (
  "id"        TEXT PRIMARY KEY,
  "type"      TEXT NOT NULL, -- user | guild
  "targetId"  TEXT NOT NULL,
  "reason"    TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Blacklist_unique_type_target" UNIQUE ("type", "targetId")
);

CREATE INDEX IF NOT EXISTS "Blacklist_type_idx"
  ON "Blacklist" ("type");

CREATE INDEX IF NOT EXISTS "Blacklist_targetId_idx"
  ON "Blacklist" ("targetId");

COMMENT ON TABLE "Blacklist" IS 'Lista negra de usuários e servidores';

-- ---------------------------------------------------------------------------
-- Premium — planos premium por servidor
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Premium" (
  "id"           TEXT PRIMARY KEY,
  "guildId"      TEXT NOT NULL UNIQUE,
  "plan"         "PremiumPlan" NOT NULL DEFAULT 'NONE',
  "priority"     INTEGER NOT NULL DEFAULT 0,
  "highlightAds" BOOLEAN NOT NULL DEFAULT FALSE,
  "maxAdsPerDay" INTEGER NOT NULL DEFAULT 1,
  "expiresAt"    TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Premium_plan_idx"
  ON "Premium" ("plan");

CREATE INDEX IF NOT EXISTS "Premium_expiresAt_idx"
  ON "Premium" ("expiresAt");

COMMENT ON TABLE "Premium" IS 'Assinaturas premium com prioridade e destaque';

DROP TRIGGER IF EXISTS trg_premium_updated_at ON "Premium";
CREATE TRIGGER trg_premium_updated_at
  BEFORE UPDATE ON "Premium"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- LogEvent — logs do sistema
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "LogEvent" (
  "id"        TEXT PRIMARY KEY,
  "type"      TEXT NOT NULL,
  "guildId"   TEXT,
  "userId"    TEXT,
  "message"   TEXT NOT NULL,
  "meta"      JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "LogEvent_type_createdAt_idx"
  ON "LogEvent" ("type", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "LogEvent_guildId_createdAt_idx"
  ON "LogEvent" ("guildId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "LogEvent_userId_idx"
  ON "LogEvent" ("userId");

COMMENT ON TABLE "LogEvent" IS 'Logs de anúncios, erros, blacklist, premium e eventos do bot';

-- ---------------------------------------------------------------------------
-- Seed inicial
-- ---------------------------------------------------------------------------
INSERT INTO "Analytics" ("id", "totalAds", "totalDeliveries", "totalFailures", "connectedGuilds")
VALUES ('global', 0, 0, 0, 0)
ON CONFLICT ("id") DO NOTHING;

COMMIT;

-- =============================================================================
-- Views úteis (analytics)
-- =============================================================================

CREATE OR REPLACE VIEW "v_top_ads" AS
SELECT
  a."id",
  a."title",
  a."category",
  a."guildId",
  a."sentCount",
  a."failedCount",
  a."createdAt"
FROM "Advertisement" a
ORDER BY a."sentCount" DESC, a."createdAt" DESC;

CREATE OR REPLACE VIEW "v_network_stats" AS
SELECT
  (SELECT COUNT(*) FROM "GuildSettings" WHERE "adsEnabled" = TRUE) AS "active_servers",
  (SELECT COUNT(*) FROM "Advertisement") AS "total_ads",
  (SELECT COUNT(*) FROM "AdDelivery" WHERE "status" = 'sent') AS "total_sent",
  (SELECT COUNT(*) FROM "AdDelivery" WHERE "status" = 'failed') AS "total_failed",
  (SELECT COUNT(*) FROM "Premium" WHERE "plan" <> 'NONE') AS "premium_servers";
