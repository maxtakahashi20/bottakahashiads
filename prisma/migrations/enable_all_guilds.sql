-- Ativa recebimento em servidores com padrão antigo (adsEnabled false)
UPDATE "GuildSettings" SET "adsEnabled" = true WHERE "adsEnabled" = false;
