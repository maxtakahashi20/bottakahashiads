-- Execute no Supabase SQL Editor se prisma migrate não rodar:
ALTER TABLE "Analytics" ADD COLUMN IF NOT EXISTS "networkEnabled" BOOLEAN NOT NULL DEFAULT true;
