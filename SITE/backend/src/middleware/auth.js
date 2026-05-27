const { verifyAccess } = require('../lib/jwt');
const { prisma } = require('../lib/prisma');
const { env } = require('../config/env');

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token =
    (header && header.startsWith('Bearer ') ? header.slice(7) : null) ||
    req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({ ok: false, error: 'Não autenticado' });
  }

  try {
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

    if (!tenant) {
      return res.status(403).json({ ok: false, error: 'Tenant não encontrado' });
    }

    const isPlatformOwner = env.platformOwnerIds.includes(decoded.discordId);
    if (!isPlatformOwner && tenant.ownerUserId !== decoded.discordId) {
      return res.status(403).json({ ok: false, error: 'Sem permissão neste ambiente' });
    }

    if (!isPlatformOwner && tenant.status !== 'ACTIVE') {
      return res.status(403).json({ ok: false, error: 'Ambiente inativo ou expirado' });
    }

    req.auth = {
      discordId: decoded.discordId,
      tenantId: tenant.id,
      tenant,
      subscription: tenant.subscriptions[0] || null,
      isPlatformOwner
    };
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: 'Token inválido ou expirado' });
  }
}

function requireInternal(req, res, next) {
  if (req.header('x-internal-key') !== env.internalApiKey) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  return next();
}

module.exports = { requireAuth, requireInternal };
