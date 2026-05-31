const { setTimeout: delay } = require('timers/promises');
const { DM_BROADCAST } = require('../../config/constants');
const { splitDiscordContent } = require('../../utils/discordMessage');

/** Delay padrão entre DMs (embed/anúncio legado) */
const DM_DELAY_MS = 1200;

function isDmClosedError(err) {
  const code = err?.code ?? err?.rawError?.code;
  return code === 50007;
}

function isRateLimitError(err) {
  return err?.status === 429;
}

/**
 * @param {import('../../structures/ExtendedClient').ExtendedClient} client
 * @param {string} guildId
 */
async function fetchHumanMembers(client, guildId) {
  const guild = await client.guilds.fetch(guildId).catch(() => null);
  if (!guild) return [];

  await guild.members.fetch().catch(() => null);

  return [...guild.members.cache.values()].filter((m) => !m.user.bot);
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').APIEmbed} embedData
 * @param {import('discord.js').ActionRowBuilder[]} components
 */
async function sendDmEmbedToMember(member, embedData, components) {
  const dm = await member.createDM();
  await dm.send({
    embeds: [embedData],
    components,
    allowedMentions: { parse: [] }
  });
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {string} content
 */
async function sendDmTextToMember(member, content) {
  const dm = await member.createDM();
  const parts = splitDiscordContent(content);
  for (const part of parts) {
    // eslint-disable-next-line no-await-in-loop
    await dm.send({
      content: part,
      allowedMentions: { parse: [] }
    });
  }
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {() => Promise<void>} sendFn
 */
async function trySendWithRateLimit(member, sendFn) {
  try {
    await sendFn();
    return { status: 'sent', error: null };
  } catch (err) {
    if (isRateLimitError(err)) {
      const waitMs = (err.retryAfter ?? 5) * 1000;
      await delay(waitMs);
      try {
        await sendFn();
        return { status: 'sent', error: null };
      } catch (retryErr) {
        if (isDmClosedError(retryErr)) {
          return { status: 'dm_closed', error: String(retryErr?.message || retryErr) };
        }
        return { status: 'failed', error: String(retryErr?.message || retryErr) };
      }
    }
    if (isDmClosedError(err)) {
      return { status: 'dm_closed', error: String(err?.message || err) };
    }
    return { status: 'failed', error: String(err?.message || err) };
  }
}

/**
 * Envia anúncio por DM para todos os membros humanos de um servidor.
 * @returns {{ ok: number, fail: number, dmClosed: number, members: number, deliveries: Array }}
 */
async function deliverToGuildMembers(client, { guildId, embed, components }) {
  const members = await fetchHumanMembers(client, guildId);
  const embedData = embed.toJSON();
  let ok = 0;
  let fail = 0;
  let dmClosed = 0;
  const deliveries = [];

  for (const member of members) {
    // eslint-disable-next-line no-await-in-loop
    const result = await trySendWithRateLimit(member, () =>
      sendDmEmbedToMember(member, embedData, components)
    );

    if (result.status === 'sent') ok += 1;
    else if (result.status === 'dm_closed') dmClosed += 1;
    else fail += 1;

    deliveries.push({ userId: member.id, status: result.status, error: result.error });

    // eslint-disable-next-line no-await-in-loop
    await delay(DM_DELAY_MS);
  }

  return { ok, fail, dmClosed, members: members.length, deliveries };
}

/**
 * Envia mensagem de texto por DM, um membro por vez.
 * @param {object} opts
 * @param {number} opts.delayMs
 * @param {(stats: { sent: number, failed: number, dmClosed: number, total: number, processed: number }) => Promise<void>} [opts.onProgress]
 * @returns {{ ok: number, fail: number, dmClosed: number, members: number, deliveries: Array }}
 */
async function deliverPlainTextToGuildMembers(
  client,
  { guildId, content, delayMs, onProgress }
) {
  const members = await fetchHumanMembers(client, guildId);
  let ok = 0;
  let fail = 0;
  let dmClosed = 0;
  const deliveries = [];
  const total = members.length;

  for (let i = 0; i < members.length; i += 1) {
    const member = members[i];
    // eslint-disable-next-line no-await-in-loop
    const result = await trySendWithRateLimit(member, () => sendDmTextToMember(member, content));

    if (result.status === 'sent') ok += 1;
    else if (result.status === 'dm_closed') dmClosed += 1;
    else fail += 1;

    deliveries.push({ userId: member.id, status: result.status, error: result.error });

    const processed = i + 1;
    if (
      onProgress &&
      (processed % DM_BROADCAST.progressUpdateEvery === 0 || processed === total)
    ) {
      // eslint-disable-next-line no-await-in-loop
      await onProgress({ sent: ok, failed: fail, dmClosed, total, processed });
    }

    if (i < members.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await delay(delayMs);
    }
  }

  return { ok, fail, dmClosed, members: total, deliveries };
}

module.exports = {
  fetchHumanMembers,
  deliverToGuildMembers,
  deliverPlainTextToGuildMembers,
  DM_DELAY_MS,
  isDmClosedError
};
