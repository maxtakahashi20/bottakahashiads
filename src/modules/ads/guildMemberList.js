const {
  fetchUserGuilds,
  fetchGuildMemberUserIds,
  fetchMemberIdsFromGuildChannels
} = require('../tokens/userTokenApi');
const { formatGuildMembersAccessError } = require('../../utils/discordErrors');

function suggestSimilarGuildId(requestedId, guilds) {
  const id = String(requestedId);
  let best = null;
  let bestDist = 3;
  for (const g of guilds) {
    if (g.id.length !== id.length) continue;
    let dist = 0;
    for (let i = 0; i < id.length; i += 1) {
      if (id[i] !== g.id[i]) dist += 1;
    }
    if (dist > 0 && dist < bestDist) {
      bestDist = dist;
      best = g;
    }
  }
  return bestDist <= 2 ? best : null;
}

async function fetchMembersViaBot(client, guildId) {
  if (!client?.guilds) {
    return { ok: false, inGuild: false, reason: 'no_client' };
  }
  try {
    const guild = await client.guilds.fetch(String(guildId));
    if (!guild) return { ok: false, inGuild: false, reason: 'bot_not_in_guild' };
    await guild.members.fetch().catch(() => {});
    const memberIds = guild.members.cache
      .filter((m) => !m.user?.bot)
      .map((m) => m.id);
    return {
      ok: memberIds.length > 0,
      inGuild: true,
      memberIds: [...new Set(memberIds)],
      guildName: guild.name
    };
  } catch {
    return { ok: false, inGuild: false, reason: 'bot_not_in_guild' };
  }
}

/**
 * Resolve lista de membros: valida servidor da conta, API usuário, bot, canais.
 */
async function resolveGuildMemberIds({ client, guildId, userToken }) {
  const guildsRes = await fetchUserGuilds(userToken);
  if (!guildsRes.ok) {
    return { ok: false, error: guildsRes.error, guildName: null };
  }

  const id = String(guildId).trim();
  const match = guildsRes.guilds.find((g) => g.id === id);
  if (!match) {
    const suggestion = suggestSimilarGuildId(id, guildsRes.guilds);
    let error =
      `A conta do TOKEN **não está** no servidor \`${id}\` (ou o ID está errado).`;
    if (suggestion) {
      error += `\nTalvez você quis **${suggestion.name}** — ID: \`${suggestion.id}\`.`;
    } else {
      error +=
        '\nNo Discord: ícone do servidor → **Copiar ID do servidor** (não é ID de canal).';
    }
    return { ok: false, error, guildName: null };
  }

  const guildName = match.name;

  const userApi = await fetchGuildMemberUserIds(id, userToken);
  if (userApi.ok && userApi.memberIds.length > 0) {
    return {
      ok: true,
      memberIds: userApi.memberIds,
      guildName: userApi.guildName || guildName,
      notice: null,
      source: 'user_api'
    };
  }

  let botResult = null;
  if (client) {
    botResult = await fetchMembersViaBot(client, id);
    if (botResult.ok && botResult.memberIds.length > 0) {
      return {
        ok: true,
        memberIds: botResult.memberIds,
        guildName: botResult.guildName || guildName,
        notice:
          'Lista obtida pelo **bot** no servidor; as DMs saem pelo **TOKEN** da sua conta no modal.',
        source: 'bot'
      };
    }
  }

  const partial = await fetchMemberIdsFromGuildChannels(id, userToken);
  if (partial.ok && partial.memberIds.length > 0) {
    return {
      ok: true,
      memberIds: partial.memberIds,
      guildName,
      notice:
        'Lista **parcial**: quem apareceu em mensagens recentes nos canais que sua conta vê (a API bloqueou a lista completa).',
      source: 'channels_partial'
    };
  }

  const membersDenied =
    !userApi.ok && userApi.error && /50001/.test(String(userApi.error));

  return {
    ok: false,
    error: formatGuildMembersAccessError({
      membersDenied,
      guildName,
      botInGuild: botResult?.inGuild === true,
      botAttempted: !!client
    }),
    guildName
  };
}

module.exports = {
  resolveGuildMemberIds,
  fetchMembersViaBot,
  suggestSimilarGuildId
};
