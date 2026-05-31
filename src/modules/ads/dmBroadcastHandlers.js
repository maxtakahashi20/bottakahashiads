const { isPlatformOwner } = require('../../utils/permissions');
const { deferEphemeral } = require('../../utils/interaction');
const { DM_BROADCAST } = require('../../config/constants');
const { PLATFORM_TENANT_ID } = require('../../config/licensing');
const {
  validateDmBroadcastInput,
  checkDmBroadcastCooldown,
  setDmBroadcastCooldown,
  dmBroadcastGuildCooldownKey,
  dmBroadcastFriendsCooldownKey
} = require('../../utils/dmBroadcast');
const { MODAL_IDS, isDmBroadcastModalId } = require('./dmBroadcastModal');
const { deliverPlainTextToFriends } = require('./friendsDmService');
const { deliverPlainTextToGuildMembersViaUser } = require('./guildDmService');

function formatRetry(ms) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.ceil(s / 60);
  return `${m}min`;
}

async function resolveOwnerToken(client, ownerId) {
  const resolved = await client.services.userTokens.resolveForOwner(ownerId, PLATFORM_TENANT_ID);
  if (!resolved) {
    return {
      ok: false,
      message: [
        '❌ **Nenhum token de usuário** configurado.',
        'Adicione o token da **sua conta** em `/painel` → **Tokens** → **Adicionar Token**.',
        '',
        '_Os envios usam **sua conta**, não o bot. Você precisa estar no servidor (para `/enviardm-servidor`)._'
      ].join('\n')
    };
  }
  return { ok: true, ...resolved };
}

/**
 * @param {import('../../structures/ExtendedClient').ExtendedClient} client
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleDmBroadcastModal(client, interaction) {
  const customId = interaction.customId;
  if (!isDmBroadcastModalId(customId)) return false;

  await deferEphemeral(interaction);

  if (!isPlatformOwner(interaction)) {
    await interaction.editReply({
      content: '🔒 Apenas quem está em **`BOT_OWNER_IDS`** pode usar este comando.'
    });
    return true;
  }

  const isFriends = customId === MODAL_IDS.friends;
  const isGuild = customId === MODAL_IDS.guild;

  const raw = {
    intervalo: interaction.fields.getTextInputValue('intervalo'),
    mensagem: interaction.fields.getTextInputValue('mensagem')
  };
  if (isGuild) {
    raw.servidor_id = interaction.fields.getTextInputValue('servidor_id');
  }

  const v = validateDmBroadcastInput(raw, { requireGuildId: isGuild });
  if (!v.ok) {
    await interaction.editReply({ content: `❌ ${v.error}` });
    return true;
  }

  const { delaySec, mensagem, guildId } = v.data;
  const delayMs = delaySec * 1000;
  const ownerId = interaction.user.id;

  await client.services.blacklist.warm();
  const userBlocked = await client.services.blacklist.isBlacklisted('user', ownerId);
  if (userBlocked) {
    await interaction.editReply({ content: 'Você está bloqueado de usar esta função.' });
    return true;
  }

  const tokenRes = await resolveOwnerToken(client, ownerId);
  if (!tokenRes.ok) {
    await interaction.editReply({ content: tokenRes.message });
    return true;
  }

  const { token, row, profileId } = tokenRes;

  if (isFriends) {
    const cdKey = dmBroadcastFriendsCooldownKey(ownerId);
    const dmCd = checkDmBroadcastCooldown(client, cdKey);
    if (!dmCd.ok) {
      await interaction.editReply({
        content: `⏳ Aguarde antes de outra campanha para **amigos**. Tente em **${formatRetry(dmCd.retryAfterMs)}**.`
      });
      return true;
    }

    setDmBroadcastCooldown(client, cdKey);

    await interaction.editReply({
      content: [
        `📨 **DM para amigos** (${row.username})…`,
        `⏱️ Intervalo: **${delaySec}s**`,
        '👥 Carregando lista de amigos…'
      ].join('\n')
    });

    const result = await deliverPlainTextToFriends({
      userToken: token,
      accountUserId: profileId,
      content: mensagem,
      delayMs,
      onProgress: async ({ sent, failed, dmClosed, total, processed }) => {
        try {
          await interaction.editReply({
            content: [
              `📨 **Amigos** (${row.username})`,
              `📊 **${processed}/${total}** · ✅ **${sent}** · 🔒 **${dmClosed}** · ❌ **${failed}**`
            ].join('\n')
          });
        } catch (_) {}
      }
    });

    if (result.fatalError) {
      await interaction.editReply({
        content: `❌ ${result.fatalError}\nAtualize o token em \`/painel\` → **Tokens**.`
      });
      return true;
    }

    await finishFriendsReply(interaction, result, delaySec);
    logDm(client, 'dm_broadcast_friends', interaction, ownerId, result, delaySec);
    return true;
  }

  const guildBlocked = await client.services.blacklist.isBlacklisted('guild', guildId);
  if (guildBlocked) {
    await interaction.editReply({ content: 'Este servidor está bloqueado.' });
    return true;
  }

  const cdKey = dmBroadcastGuildCooldownKey(guildId);
  const dmCd = checkDmBroadcastCooldown(client, cdKey);
  if (!dmCd.ok) {
    await interaction.editReply({
      content: `⏳ Aguarde antes de outra campanha em \`${guildId}\`. Tente em **${formatRetry(dmCd.retryAfterMs)}**.`
    });
    return true;
  }

  setDmBroadcastCooldown(client, cdKey);

  await interaction.editReply({
    content: [
      `📨 **DM no servidor** (${row.username})…`,
      `🏠 ID: \`${guildId}\``,
      `⏱️ Intervalo: **${delaySec}s**`,
      '👥 Listando membros com **sua conta** (você precisa estar no servidor)…'
    ].join('\n')
  });

  const result = await deliverPlainTextToGuildMembersViaUser({
    userToken: token,
    guildId,
    accountUserId: profileId,
    content: mensagem,
    delayMs,
    onProgress: async ({ sent, failed, dmClosed, total, processed }) => {
      try {
        await interaction.editReply({
          content: [
            `📨 **Servidor** \`${guildId}\` (${row.username})`,
            `📊 **${processed}/${total}** · ✅ **${sent}** · 🔒 **${dmClosed}** · ❌ **${failed}**`
          ].join('\n')
        });
      } catch (_) {}
    }
  });

  if (result.fatalError) {
    await interaction.editReply({
      content: `❌ ${result.fatalError}\nConfira o **ID do servidor** e se **sua conta** está nele.`
    });
    return true;
  }

  const guildName = result.guildName || guildId;
  const estMinutes = Math.ceil((result.members * delaySec) / 60);

  await interaction.editReply({
    content: [
      '✅ **Campanha no servidor concluída**',
      `🏠 **${guildName}** (\`${guildId}\`)`,
      `👥 Membros: **${result.members}**`,
      `✅ Enviadas: **${result.ok}**`,
      `🔒 DM fechada: **${result.dmClosed}**`,
      `❌ Outras falhas: **${result.fail}**`,
      `⏱️ Intervalo: **${delaySec}s** (~${estMinutes} min)`,
      '',
      '_Enviado pela **sua conta** (token). Quem bloqueou DM não recebe._',
      `Próximo envio neste servidor em **${Math.round(DM_BROADCAST.guildCooldownSec / 60)} min**.`
    ].join('\n')
  });

  client.services.logs
    .write('dm_broadcast_guild', {
      guildId,
      userId: ownerId,
      message: `DM servidor ${guildName}: ${result.ok} ok`,
      meta: {
        delaySec,
        members: result.members,
        ok: result.ok,
        dmClosed: result.dmClosed,
        fail: result.fail,
        viaUserToken: true
      }
    })
    .catch(() => {});

  return true;
}

async function finishFriendsReply(interaction, result, delaySec) {
  const estMinutes = Math.ceil((result.members * delaySec) / 60);
  await interaction.editReply({
    content: [
      '✅ **Campanha para amigos concluída**',
      `👥 Amigos: **${result.members}**`,
      `✅ Enviadas: **${result.ok}**`,
      `🔒 DM fechada: **${result.dmClosed}**`,
      `❌ Outras falhas: **${result.fail}**`,
      `⏱️ Intervalo: **${delaySec}s** (~${estMinutes} min)`,
      '',
      `Próximo envio para amigos em **${Math.round(DM_BROADCAST.guildCooldownSec / 60)} min**.`
    ].join('\n')
  });
}

function logDm(client, type, interaction, ownerId, result, delaySec) {
  client.services.logs
    .write(type, {
      guildId: interaction.guildId,
      userId: ownerId,
      message: `DM: ${result.ok} ok`,
      meta: { delaySec, members: result.members, ok: result.ok, fail: result.fail, viaUserToken: true }
    })
    .catch(() => {});
}

function isDmBroadcastModal(customId) {
  return isDmBroadcastModalId(customId);
}

module.exports = { handleDmBroadcastModal, isDmBroadcastModal };
