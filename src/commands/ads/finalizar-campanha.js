const { SlashCommandBuilder } = require('discord.js');
const { isPlatformOwner, MSG_PLATFORM_ACCESS_DENIED } = require('../../utils/permissions');
const { safeReply, deferEphemeral } = require('../../utils/interaction');
const { clearDmBroadcastCooldowns, isSnowflake } = require('../../utils/dmBroadcast');
const {
  abortCampaign,
  getActiveCampaign
} = require('../../modules/ads/dmCampaignRegistry');
const { userFacingError } = require('../../utils/discordErrors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('finalizar-campanha')
    .setDescription('Encerra a campanha de DM e libera novo envio.')
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
        content: userFacingError(MSG_PLATFORM_ACCESS_DENIED, { title: 'Acesso negado' })
      });
      return;
    }

    await deferEphemeral(interaction);

    const ownerId = interaction.user.id;
    const guildIdOpt = interaction.options.getString('servidor_id')?.trim() || null;

    if (guildIdOpt && !isSnowflake(guildIdOpt)) {
      await interaction.editReply({
        content: userFacingError(
          'O parâmetro servidor_id deve conter entre 17 e 20 dígitos numéricos.',
          { title: 'Parâmetro inválido' }
        )
      });
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
