-- Continuação se os passos 1–4 já rodaram e falhou só no passo 5
-- Cole APENAS este bloco no SQL Editor do Supabase

ALTER TABLE "Partnership" DROP CONSTRAINT IF EXISTS "Partnership_guildAId_fkey";
ALTER TABLE "Partnership" DROP CONSTRAINT IF EXISTS "Partnership_guildBId_fkey";
ALTER TABLE "Partnership" DROP CONSTRAINT IF EXISTS "Partnership_unique_pair";

ALTER TABLE "GuildSettings" DROP CONSTRAINT IF EXISTS "GuildSettings_guildId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "GuildSettings_tenantId_guildId_key"
  ON "GuildSettings" ("tenantId", "guildId");

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
