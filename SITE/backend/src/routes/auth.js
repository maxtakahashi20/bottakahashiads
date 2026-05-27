const express = require('express');
const { prisma } = require('../lib/prisma');
const { env } = require('../config/env');
const { signAccess, hashRefresh, randomRefresh } = require('../lib/jwt');

const router = express.Router();

const DISCORD_API = 'https://discord.com/api/v10';

router.get('/discord', (_req, res) => {
  if (!env.discordClientSecret) {
    return res.status(503).json({ ok: false, error: 'DISCORD_CLIENT_SECRET não configurado' });
  }
  const params = new URLSearchParams({
    client_id: env.discordClientId,
    redirect_uri: env.discordRedirectUri,
    response_type: 'code',
    scope: 'identify email'
  });
  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${env.webUrl}/login?error=no_code`);

  try {
    const tokenRes = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.discordClientId,
        client_secret: env.discordClientSecret,
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: env.discordRedirectUri
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error('Discord OAuth token failed', {
        status: tokenRes.status,
        error: tokenData.error,
        description: tokenData.error_description
      });
      const errCode = encodeURIComponent(tokenData.error || 'oauth_failed');
      const errDesc = encodeURIComponent(tokenData.error_description || '');
      return res.redirect(`${env.webUrl}/login?error=${errCode}&desc=${errDesc}`);
    }

    const userRes = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const user = await userRes.json();

    let tenant = await prisma.tenant.findUnique({
      where: { ownerUserId: user.id }
    });

    if (!tenant && env.platformOwnerIds.includes(user.id)) {
      tenant = await prisma.tenant.findFirst({ where: { isPlatform: true } });
    }

    if (!tenant) {
      return res.redirect(`${env.webUrl}/login?error=no_tenant`);
    }

    const refresh = randomRefresh();
    const refreshHash = hashRefresh(refresh);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    try {
      await prisma.webSession.create({
        data: {
          discordId: user.id,
          tenantId: tenant.id,
          refreshHash,
          expiresAt
        }
      });
    } catch (sessionErr) {
      console.warn('WebSession não salva (rode web_panel_saas.sql se necessário)', sessionErr.message);
    }

    const access = signAccess({
      discordId: user.id,
      tenantId: tenant.id,
      username: user.username
    });

    const redirect = new URL(`${env.webUrl}/auth/success`);
    redirect.searchParams.set('token', access);
    redirect.searchParams.set('refresh', refresh);
    res.redirect(redirect.toString());
  } catch (err) {
    console.error('OAuth callback error', err);
    res.redirect(`${env.webUrl}/login?error=server`);
  }
});

router.get('/me', async (req, res) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false });

  try {
    const { verifyAccess } = require('../lib/jwt');
    const decoded = verifyAccess(token);
    const tenant = await prisma.tenant.findUnique({
      where: { id: decoded.tenantId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE', endsAt: { gt: new Date() } },
          take: 1,
          include: { license: true }
        }
      }
    });
    res.json({
      ok: true,
      user: { id: decoded.discordId, username: decoded.username },
      tenant,
      subscription: tenant?.subscriptions?.[0] || null
    });
  } catch {
    res.status(401).json({ ok: false });
  }
});

module.exports = { authRouter: router };
