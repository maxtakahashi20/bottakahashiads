const { setTimeout: delay } = require('timers/promises');
const { DM_BROADCAST } = require('../../config/constants');
const { splitDiscordContent } = require('../../utils/discordMessage');
const { HISTORY_LIMIT, isDuplicateDmContent, buildOutboundFingerprint } = require('../../utils/dmAntiflood');

/** Delay padrão entre DMs (bot) */
const DM_DELAY_MS = 5000;

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

async function channelHasDuplicate(dmChannel, outboundText, senderId) {
  const messages = await dmChannel.messages.fetch({ limit: HISTORY_LIMIT }).catch(() => null);
  if (!messages) return false;
  const arr = [...messages.values()].map((m) => ({
    content: m.content,
    embeds: m.embeds,
    author: { id: m.author?.id }
  }));
  return isDuplicateDmContent(arr, outboundText, senderId).duplicate;
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {import('discord.js').APIEmbed} embedData
 * @param {import('discord.js').ActionRowBuilder[]} components
 * @param {string} senderId
 */
async function sendDmEmbedToMember(member, embedData, components, senderId) {
  const dm = await member.createDM();
  const fingerprint = buildOutboundFingerprint('', { embeds: [embedData] });
  if (senderId && (await channelHasDuplicate(dm, fingerprint, senderId))) {
    return { skipped: true };
  }
  await dm.send({
    embeds: [embedData],
    components,
    allowedMentions: { parse: [] }
  });
  return { skipped: false };
}

/**
 * @param {import('discord.js').GuildMember} member
 * @param {string} content
 * @param {string} senderId
 */
async function sendDmTextToMember(member, content, senderId) {
  const dm = await member.createDM();
  if (senderId && (await channelHasDuplicate(dm, content, senderId))) {
    return { skipped: true };
  }
  const parts = splitDiscordContent(content);
  for (const part of parts) {
    // eslint-disable-next-line no-await-in-loop
    await dm.send({
      content: part,
      allowedMentions: { parse: [] }
    });
  }
  return { skipped: false };
}

async function trySendWithRateLimit(member, sendFn) {
  try {
    const r = await sendFn();
    if (r?.skipped) return { status: 'skipped', error: null };
    return { status: 'sent', error: null };
  } catch (err) {
    if (isRateLimitError(err)) {
      const waitMs = (err.retryAfter ?? 10) * 1000;
      await delay(waitMs);
      try {
        const r = await sendFn();
        if (r?.skipped) return { status: 'skipped', error: null };
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

async function deliverToGuildMembers(client, { guildId, embed, components }) {
  const members = await fetchHumanMembers(client, guildId);
  const embedData = embed.toJSON();
  const senderId = client.user?.id;
  let ok = 0;
  let fail = 0;
  let dmClosed = 0;
  let skipped = 0;
  const deliveries = [];

  for (const member of members) {
    // eslint-disable-next-line no-await-in-loop
    const result = await trySendWithRateLimit(member, () =>
      sendDmEmbedToMember(member, embedData, components, senderId)
    );

    if (result.status === 'sent') ok += 1;
    else if (result.status === 'skipped') skipped += 1;
    else if (result.status === 'dm_closed') dmClosed += 1;
    else fail += 1;

    deliveries.push({ userId: member.id, status: result.status, error: result.error });

    // eslint-disable-next-line no-await-in-loop
    await delay(DM_DELAY_MS);
  }

  return { ok, fail, dmClosed, skipped, members: members.length, deliveries };
}

async function deliverPlainTextToGuildMembers(
  client,
  { guildId, content, delayMs, onProgress, shouldAbort }
) {
  const members = await fetchHumanMembers(client, guildId);
  const senderId = client.user?.id;
  let ok = 0;
  let fail = 0;
  let dmClosed = 0;
  let skipped = 0;
  const deliveries = [];
  const total = members.length;
  let aborted = false;

  for (let i = 0; i < members.length; i += 1) {
    if (shouldAbort?.()) {
      aborted = true;
      break;
    }

    const member = members[i];
    // eslint-disable-next-line no-await-in-loop
    const result = await trySendWithRateLimit(member, () =>
      sendDmTextToMember(member, content, senderId)
    );

    if (result.status === 'sent') ok += 1;
    else if (result.status === 'skipped') skipped += 1;
    else if (result.status === 'dm_closed') dmClosed += 1;
    else fail += 1;

    deliveries.push({ userId: member.id, status: result.status, error: result.error });

    const processed = i + 1;
    if (
      onProgress &&
      (processed % DM_BROADCAST.progressUpdateEvery === 0 || processed === total)
    ) {
      // eslint-disable-next-line no-await-in-loop
      await onProgress({ sent: ok, failed: fail, dmClosed, skipped, total, processed });
    }

    if (i < members.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await delay(delayMs);
    }
  }

  return { ok, fail, dmClosed, skipped, members: total, deliveries, aborted };
}

module.exports = {
  fetchHumanMembers,
  deliverToGuildMembers,
  deliverPlainTextToGuildMembers,
  DM_DELAY_MS,
  isDmClosedError
};
