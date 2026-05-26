const { setTimeout: delay } = require('timers/promises');

/** Delay entre DMs para respeitar rate limit do Discord */
const DM_DELAY_MS = 1200;

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
async function sendDmToMember(member, embedData, components) {
  const dm = await member.createDM();
  await dm.send({
    embeds: [embedData],
    components,
    allowedMentions: { parse: [] }
  });
}

/**
 * Envia anúncio por DM para todos os membros humanos de um servidor.
 * @returns {{ ok: number, fail: number, members: number, deliveries: Array }}
 */
async function deliverToGuildMembers(client, { guildId, embed, components }) {
  const members = await fetchHumanMembers(client, guildId);
  const embedData = embed.toJSON();
  let ok = 0;
  let fail = 0;
  const deliveries = [];

  for (const member of members) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sendDmToMember(member, embedData, components);
      ok += 1;
      deliveries.push({ userId: member.id, status: 'sent', error: null });
    } catch (err) {
      if (err?.status === 429) {
        const waitMs = (err.retryAfter ?? 5) * 1000;
        // eslint-disable-next-line no-await-in-loop
        await delay(waitMs);
        try {
          // eslint-disable-next-line no-await-in-loop
          await sendDmToMember(member, embedData, components);
          ok += 1;
          deliveries.push({ userId: member.id, status: 'sent', error: null });
        } catch (retryErr) {
          fail += 1;
          deliveries.push({
            userId: member.id,
            status: 'failed',
            error: String(retryErr?.message || retryErr)
          });
        }
      } else {
        fail += 1;
        deliveries.push({
          userId: member.id,
          status: 'failed',
          error: String(err?.message || err)
        });
      }
    }

    // eslint-disable-next-line no-await-in-loop
    await delay(DM_DELAY_MS);
  }

  return { ok, fail, members: members.length, deliveries };
}

module.exports = { fetchHumanMembers, deliverToGuildMembers, DM_DELAY_MS };
