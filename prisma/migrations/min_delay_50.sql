-- Mínimo 50 min entre divulgações
UPDATE "SystemConfig" SET "minCycleMinutes" = 50 WHERE "minCycleMinutes" < 50;
UPDATE "GuildSettings" SET "delayMinutes" = 50 WHERE "delayMinutes" < 50;
