const { SlashCommandBuilder } = require('discord.js');
const { isPlatformOwner } = require('../../utils/permissions');
const { safeReply, deferEphemeral } = require('../../utils/interaction');
const { clearDmBroadcastCooldowns, isSnowflake } = require('../../utils/dmBroadcast');
const {
  abortCampaign,
  getActiveCampaign
} = require('../../modules/ads/dmCampaignRegistry');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('finalizar-campanha')
    .setDescription('[BOT_OWNER_IDS] Para a campanha de DM e libera enviar de novo.')
    .setDMPermission(true)
    .addStringOption((opt) =>
      opt
        .setName('servidor_id')
        .setDescription('Opcional: limpar cooldown só deste servidor')
        .setRequired(false)
        .setMinLength(17)
        .setMaxLength(20)
    ),

  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(client, interaction) {
    if (!isPlatformOwner(interaction)) {
      await safeReply(interaction, {
        content: '🔒 Apenas quem está em `BOT_OWNER_IDS` pode usar este comando.'
      });
      return;
    }

    await deferEphemeral(interaction);

    const ownerId = interaction.user.id;
    const guildIdOpt = interaction.options.getString('servidor_id')?.trim() || null;

    if (guildIdOpt && !isSnowflake(guildIdOpt)) {
      await interaction.editReply({ content: '❌ **servidor_id** inválido.' });
      return;
    }

    const active = getActiveCampaign(ownerId);
    const wasRunning = abortCampaign(ownerId);
    const { cleared } = clearDmBroadcastCooldowns(client, ownerId, {
      guildId: guildIdOpt || undefined
    });

    const lines = ['✅ **Campanha finalizada** — você já pode usar `/enviardm` ou `/enviardm-servidor` de novo.'];

    if (wasRunning || active) {
      const tipo = active?.type === 'guild' ? 'servidor' : 'amigos';
      lines.push(`🛑 Envio em andamento (**${tipo}**) será interrompido no próximo contato.`);
    } else {
      lines.push('ℹ️ Nenhum envio estava rodando neste momento (só o cooldown foi limpo).');
    }

    if (cleared.length) {
      lines.push(`🔓 Cooldown removido: **${cleared.join(', ')}**`);
    } else {
      lines.push('🔓 Nenhum cooldown de DM estava ativo.');
    }

    await interaction.editReply({ content: lines.join('\n') });
  }
};
