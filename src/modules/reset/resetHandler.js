const { EPHEMERAL } = require('../../utils/interaction');
const { BTN, RESET_TYPES, isResetButton } = require('./resetIds');
const {
  requireTenantOwner,
  checkCooldown,
  touchCooldown,
  consumePending,
  tryAcquireResetLock,
  releaseResetLock
} = require('./resetGuard');
const { buildResultEmbed } = require('./resetPanels');

const CONFIRM_TO_TYPE = {
  [BTN.confirmGuilds]: RESET_TYPES.guilds,
  [BTN.confirmToken]: RESET_TYPES.token,
  [BTN.confirmAll]: RESET_TYPES.all,
  [BTN.confirmCycles]: RESET_TYPES.cycles
};

const CANCEL_IDS = new Set([
  BTN.cancelGuilds,
  BTN.cancelToken,
  BTN.cancelAll,
  BTN.cancelCycles
]);

async function runReset(client, type, tenantId) {
  const svc = client.services.reset;
  if (!svc) throw new Error('ResetService não inicializado');

  if (type === RESET_TYPES.guilds) return svc.resetGuilds(tenantId);
  if (type === RESET_TYPES.token) return svc.resetToken(tenantId);
  if (type === RESET_TYPES.cycles) return svc.resetCycles(tenantId);
  return svc.resetAll(tenantId);
}

async function editResetReply(interaction, payload) {
  await interaction.editReply({ ...payload, embeds: payload.embeds ?? [], components: payload.components ?? [] });
}

async function handleResetInteraction(client, interaction) {
  if (!interaction.isButton() || !isResetButton(interaction.customId)) return false;

  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferUpdate();
  }

  const owner = await requireTenantOwner(client, interaction);
  if (!owner.ok) {
    await editResetReply(interaction, { content: owner.error });
    return true;
  }

  if (CANCEL_IDS.has(interaction.customId)) {
    await editResetReply(
      interaction,
      buildResultEmbed('all', {
        ok: true,
        message: 'Reset **cancelado**. Nenhuma alteração foi feita.'
      })
    );
    return true;
  }

  const type = CONFIRM_TO_TYPE[interaction.customId];
  if (!type) {
    await editResetReply(interaction, { content: '⚠️ Ação de reset não reconhecida.' });
    return true;
  }

  if (!consumePending(client, interaction.user.id, type, owner.tenantId)) {
    await editResetReply(interaction, {
      content: '⏱️ Confirmação expirada, inválida ou já utilizada. Use o comando de reset novamente.'
    });
    return true;
  }

  const cd = checkCooldown(interaction.user.id);
  if (!cd.ok) {
    await editResetReply(interaction, { content: cd.error });
    return true;
  }

  if (!tryAcquireResetLock(owner.tenantId)) {
    await editResetReply(
      interaction,
      buildResultEmbed(type, {
        ok: false,
        message: '⏳ Já existe um reset em andamento neste ambiente. Aguarde a conclusão.'
      })
    );
    return true;
  }

  await editResetReply(
    interaction,
    buildResultEmbed(type, {
      ok: true,
      message: '⏳ Executando reset… aguarde.'
    })
  );

  try {
    const result = await runReset(client, type, owner.tenantId);
    touchCooldown(interaction.user.id);

    await client.services.audit?.write(`reset_${type}`, {
      tenantId: owner.tenantId,
      actorId: interaction.user.id,
      message: result.message,
      meta: { stats: result.stats, type }
    });

    await client.services.logs?.write(`reset_${type}`, {
      userId: interaction.user.id,
      message: `[${owner.tenantName}] ${result.message}`,
      meta: { tenantId: owner.tenantId, stats: result.stats }
    });

    client.logger.info(
      { tenantId: owner.tenantId, actor: interaction.user.id, type, stats: result.stats },
      'Reset administrativo'
    );

    await editResetReply(interaction, buildResultEmbed(type, result));
  } catch (err) {
    client.logger.error({ err, type, tenantId: owner.tenantId }, 'Falha no reset');
    await editResetReply(
      interaction,
      buildResultEmbed(type, {
        ok: false,
        message: `Erro ao executar reset: ${err.message || 'erro interno'}`
      })
    );
  } finally {
    releaseResetLock(owner.tenantId);
  }

  return true;
}

module.exports = { handleResetInteraction, isResetButton };
