const express = require('express');
const { z } = require('zod');
const { prisma } = require('../lib/prisma');
const { requireAuth, requireInternal } = require('../middleware/auth');
const { validateBody } = require('../middleware/validate');
const {
  getFullTenantConfig,
  bumpConfigVersion,
  getAnalyticsOverview,
  getLogs
} = require('../services/tenantDashboardService');

const router = express.Router();

router.get('/health', (_req, res) => res.json({ ok: true, service: 'takahashi-ads-api' }));

router.get('/dashboard/overview', requireAuth, async (req, res) => {
  const data = await getAnalyticsOverview(req.auth.tenantId);
  const config = await getFullTenantConfig(req.auth.tenantId);
  res.json({
    ok: true,
    tenant: req.auth.tenant,
    subscription: req.auth.subscription,
    overview: data,
    settings: config.settings,
    branding: config.branding
  });
});

router.get('/analytics', requireAuth, async (req, res) => {
  const data = await getAnalyticsOverview(req.auth.tenantId);
  res.json({ ok: true, data });
});

router.get('/logs', requireAuth, async (req, res) => {
  const logs = await getLogs(req.auth.tenantId, Number(req.query.limit) || 30);
  const events = await prisma.logEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: Number(req.query.limit) || 20
  });
  res.json({ ok: true, audit: logs, events });
});

const settingsSchema = z.object({
  botRunning: z.boolean().optional(),
  globalMessage: z.string().max(4000).nullable().optional(),
  globalBannerUrl: z.string().url().nullable().optional().or(z.literal('')),
  globalInviteUrl: z.string().nullable().optional(),
  messagesPerCycle: z.number().int().min(1).max(10).optional(),
  delayMsgMinSec: z.number().min(1).max(120).optional(),
  delayMsgMaxSec: z.number().min(1).max(120).optional(),
  delayGuildMinSec: z.number().min(1).max(600).optional(),
  delayGuildMaxSec: z.number().min(1).max(600).optional(),
  minCycleMinutes: z.number().min(50).max(1440).optional(),
  networkEnabled: z.boolean().optional()
});

router.get('/config', requireAuth, async (req, res) => {
  const full = await getFullTenantConfig(req.auth.tenantId);
  res.json({ ok: true, ...full });
});

router.patch('/config', requireAuth, validateBody(settingsSchema), async (req, res) => {
  const data = { ...req.body };
  if (data.globalBannerUrl === '') data.globalBannerUrl = null;

  const settings = await prisma.tenantSettings.upsert({
    where: { tenantId: req.auth.tenantId },
    create: { tenantId: req.auth.tenantId, ...data },
    update: { ...data, configVersion: { increment: 1 } }
  });

  await bumpConfigVersion(req.auth.tenantId);
  await prisma.auditLog.create({
    data: {
      tenantId: req.auth.tenantId,
      actorId: req.auth.discordId,
      action: 'web_config_update',
      message: 'Configurações atualizadas pelo painel web'
    }
  });

  res.json({ ok: true, settings });
});

const brandingSchema = z.object({
  botDisplayName: z.string().max(32).nullable().optional(),
  botAvatarUrl: z.string().url().nullable().optional().or(z.literal('')),
  botStatusText: z.string().max(128).nullable().optional(),
  botStatusType: z.enum(['online', 'idle', 'dnd', 'invisible']).optional(),
  botDescription: z.string().max(256).nullable().optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional()
});

router.patch('/branding', requireAuth, validateBody(brandingSchema), async (req, res) => {
  const data = { ...req.body };
  if (data.botAvatarUrl === '') data.botAvatarUrl = null;

  const branding = await prisma.tenantBranding.upsert({
    where: { tenantId: req.auth.tenantId },
    create: { tenantId: req.auth.tenantId, ...data },
    update: data
  });

  await bumpConfigVersion(req.auth.tenantId);
  res.json({ ok: true, branding });
});

const embedSchema = z.object({
  title: z.string().max(256).nullable().optional(),
  description: z.string().max(4096).nullable().optional(),
  color: z.number().int().min(0).max(0xffffff).nullable().optional(),
  bannerUrl: z.string().url().nullable().optional().or(z.literal('')),
  thumbnailUrl: z.string().url().nullable().optional().or(z.literal('')),
  footerText: z.string().max(2048).nullable().optional(),
  footerIconUrl: z.string().url().nullable().optional().or(z.literal('')),
  buttonLabel: z.string().max(80).nullable().optional(),
  buttonUrl: z.string().url().nullable().optional().or(z.literal('')),
  useEmbedMode: z.boolean().optional()
});

router.get('/embed', requireAuth, async (req, res) => {
  const embed = await prisma.tenantEmbedTemplate.findUnique({
    where: { tenantId: req.auth.tenantId }
  });
  res.json({ ok: true, embed });
});

router.put('/embed', requireAuth, validateBody(embedSchema), async (req, res) => {
  const data = { ...req.body };
  for (const k of ['bannerUrl', 'thumbnailUrl', 'footerIconUrl', 'buttonUrl']) {
    if (data[k] === '') data[k] = null;
  }

  const embed = await prisma.tenantEmbedTemplate.upsert({
    where: { tenantId: req.auth.tenantId },
    create: { tenantId: req.auth.tenantId, ...data },
    update: data
  });

  await bumpConfigVersion(req.auth.tenantId);
  res.json({ ok: true, embed });
});

router.get('/license', requireAuth, async (req, res) => {
  const subs = await prisma.subscription.findMany({
    where: { tenantId: req.auth.tenantId },
    include: { license: true },
    orderBy: { endsAt: 'desc' },
    take: 5
  });
  res.json({
    ok: true,
    tenant: req.auth.tenant,
    subscriptions: subs,
    active: req.auth.subscription
  });
});

router.get('/guilds', requireAuth, async (req, res) => {
  const guilds = await prisma.guildSettings.findMany({
    where: { tenantId: req.auth.tenantId },
    orderBy: { updatedAt: 'desc' }
  });
  res.json({ ok: true, guilds });
});

router.get('/internal/tenant/:tenantId/config', requireInternal, async (req, res) => {
  const full = await getFullTenantConfig(req.params.tenantId);
  res.json({ ok: true, ...full });
});

module.exports = { apiRouter: router };
