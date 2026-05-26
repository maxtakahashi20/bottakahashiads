const express = require('express');
const { BRAND } = require('../config/constants');
const { normalizeSlug, buildDiscordBotInviteUrl } = require('../utils/inviteBuilder');

/**
 * @param {import('../structures/ExtendedClient').ExtendedClient} client
 */
function createInviteRouter(client) {
  const router = express.Router();

  router.get('/invite/:slug', (req, res) => {
    const slug = normalizeSlug(req.params.slug);
    if (!slug) {
      res.status(400).send('Slug inválido.');
      return;
    }

    const discordUrl = buildDiscordBotInviteUrl(slug);

    client.services.logs
      .write('invite_link_opened', {
        message: `Redirect convite: ${slug}`,
        meta: { slug, ip: req.ip, ua: req.get('user-agent') }
      })
      .catch(() => {});

    res.setHeader('Cache-Control', 'no-store');
    res.redirect(302, discordUrl);
  });

  router.get('/invite', (_req, res) => {
    const slug = BRAND.defaultInviteSlug;
    res.redirect(302, `/invite/${slug}`);
  });

  return router;
}

module.exports = { createInviteRouter };
