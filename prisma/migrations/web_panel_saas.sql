-- Painel web SaaS: branding, embed template, sessões web, configVersion
-- Rode no Supabase após saas_licensing.sql

ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "configVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "TenantBranding" (
  "id"             TEXT NOT NULL,
  "tenantId"       TEXT NOT NULL,
  "botDisplayName" TEXT,
  "botAvatarUrl"   TEXT,
  "botStatusText"  TEXT,
  "botStatusType"  TEXT DEFAULT 'online',
  "botDescription" TEXT,
  "primaryColor"   TEXT DEFAULT '#5865F2',
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantBranding_tenantId_key" ON "TenantBranding"("tenantId");

CREATE TABLE IF NOT EXISTS "TenantEmbedTemplate" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "title"         TEXT,
  "description"   TEXT,
  "color"         INTEGER,
  "bannerUrl"     TEXT,
  "thumbnailUrl"  TEXT,
  "footerText"    TEXT,
  "footerIconUrl" TEXT,
  "buttonLabel"   TEXT,
  "buttonUrl"     TEXT,
  "useEmbedMode"  BOOLEAN NOT NULL DEFAULT false,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantEmbedTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantEmbedTemplate_tenantId_key" ON "TenantEmbedTemplate"("tenantId");

CREATE TABLE IF NOT EXISTS "WebSession" (
  "id"          TEXT NOT NULL,
  "discordId"   TEXT NOT NULL,
  "tenantId"    TEXT,
  "refreshHash" TEXT NOT NULL,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebSession_refreshHash_key" ON "WebSession"("refreshHash");
CREATE INDEX IF NOT EXISTS "WebSession_discordId_idx" ON "WebSession"("discordId");
CREATE INDEX IF NOT EXISTS "WebSession_tenantId_idx" ON "WebSession"("tenantId");

DO $$ BEGIN
  ALTER TABLE "TenantBranding" ADD CONSTRAINT "TenantBranding_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TenantEmbedTemplate" ADD CONSTRAINT "TenantEmbedTemplate_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "WebSession" ADD CONSTRAINT "WebSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
