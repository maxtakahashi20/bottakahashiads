const { splitDiscordContent } = require('../../utils/discordMessage');
const { DM_BROADCAST } = require('../../config/constants');
const { CODE_MESSAGES } = require('../../utils/discordErrors');

const STATUS_REASON = {
  sent: 'Mensagem entregue.',
  skipped: 'Não reenviado: conteúdo ou link já constava na conversa (antiflood).',
  dm_closed: CODE_MESSAGES[50007] || 'Destinatário com DM desativada.',
  failed: 'Falha no envio.'
};

function reasonForDelivery(d) {
  if (d.usedFriendFallback && d.status === 'sent') {
    return 'Primeira tentativa falhou; entregue após pedido de amizade + mensagem.';
  }
  if (d.status === 'skipped' && d.error === 'link_ja_enviado') {
    return 'Não reenviado: o link já existia na conversa.';
  }
  if (d.status === 'skipped' && d.error === 'mensagem_ja_enviada') {
    return 'Não reenviado: mensagem idêntica já havia sido enviada.';
  }
  if (d.error && d.status === 'failed') {
    const err = String(d.error).trim();
    return err.length > 200 ? `${err.slice(0, 200)}…` : err;
  }
  return STATUS_REASON[d.status] || d.status;
}

/**
 * @param {object} opts
 * @param {'friends'|'guild'} opts.type
 */
function buildCampaignReport(opts) {
  const {
    type,
    result,
    accountLabel,
    delaySec,
    aborted = false,
    fatalError = null,
    notice = null,
    guildId = null,
    guildName = null
  } = opts;

  const title = type === 'friends' ? '📊 Relatório — DM para amigos' : '📊 Relatório — DM no servidor';
  const lines = [
    title,
    `🕐 ${new Date().toLocaleString('pt-BR')}`,
    `👤 Conta usada: **${accountLabel}**`,
    type === 'guild' ? `🏠 Servidor: **${guildName || guildId}** (\`${guildId}\`)` : null,
    aborted ? '🛑 Campanha **interrompida** (`/finalizar-campanha`)' : '✅ Campanha **finalizada**',
    fatalError ? `❌ Erro: ${fatalError}` : null,
    notice ? `ℹ️ ${notice}` : null,
    '',
    '**Resumo**',
    `👥 Total na lista: **${result.members ?? 0}**`,
    `✅ Entregues agora: **${result.ok ?? 0}**`,
    (result.skipped ?? 0) > 0
      ? `📋 Já tinham sua mensagem/link (antflood, não reenviado): **${result.skipped}**`
      : null,
    (result.ok ?? 0) + (result.skipped ?? 0) > 0
      ? `📊 Alcance nesta campanha: **${(result.ok ?? 0) + (result.skipped ?? 0)}** de **${result.members ?? 0}**`
      : null,
    (result.friendRequestRetries ?? 0) > 0
      ? `🔄 Etapa extra (pedido de amizade + mensagem): **${result.friendRequestRetries}**`
      : null,
    (result.friendRequestsSent ?? 0) > 0
      ? `👋 Pedidos de amizade enviados: **${result.friendRequestsSent}**`
      : null,
    `🔒 DM fechada: **${result.dmClosed ?? 0}**`,
    `❌ Falhas: **${result.fail ?? 0}**`,
    `⏱️ Intervalo usado: **${delaySec}s**`
  ].filter((l) => l != null);

  if ((result.members ?? 0) === 0 && !fatalError) {
    lines.push('', '⚠️ **Nenhum destinatário** na lista (sem amigos ou lista vazia).');
  }

  const deliveries = result.deliveries || [];
  const byStatus = {
    failed: deliveries.filter((d) => d.status === 'failed'),
    dm_closed: deliveries.filter((d) => d.status === 'dm_closed'),
    skipped: deliveries.filter((d) => d.status === 'skipped'),
    sent: deliveries.filter((d) => d.status === 'sent')
  };

  const MAX_DETAIL = 25;

  function appendSection(heading, list) {
    if (!list.length) return;
    lines.push('', heading, `_${list.length} registro(s)_`);
    const slice = list.slice(0, MAX_DETAIL);
    for (const d of slice) {
      lines.push(`• \`${d.userId}\` — ${reasonForDelivery(d)}`);
    }
    if (list.length > MAX_DETAIL) {
      lines.push(`_… e mais ${list.length - MAX_DETAIL} (veja resumo acima)_`);
    }
  }

  appendSection('**❌ Não entregues (falha)**', byStatus.failed);
  appendSection('**🔒 Não entregues (DM fechada)**', byStatus.dm_closed);
  appendSection('**⏭️ Não reenviados (já tinham a mensagem/link)**', byStatus.skipped);

  if (byStatus.sent.length > 0 && byStatus.sent.length <= 15) {
    appendSection('**✅ Entregues**', byStatus.sent);
  } else if (byStatus.sent.length > 15) {
    lines.push('', `**✅ Entregues:** ${byStatus.sent.length} pessoas (lista omitida por tamanho)`);
  }

  lines.push('', '— Takahashi Ads');

  return splitDiscordContent(lines.join('\n'));
}

/**
 * Envia relatório na DM do usuário Discord (via bot).
 * @param {import('../../structures/ExtendedClient').ExtendedClient} client
 * @param {string} discordUserId — quem executou o comando
 */
async function sendCampaignReportDm(client, discordUserId, contentParts) {
  if (!discordUserId || !contentParts?.length) {
    return { ok: false, error: 'Conteúdo do relatório vazio; nada a enviar.' };
  }

  try {
    const user = await client.users.fetch(discordUserId);
    const dm = await user.createDM();

    for (const part of contentParts) {
      // eslint-disable-next-line no-await-in-loop
      await dm.send({ content: part, allowedMentions: { parse: [] } });
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, DM_BROADCAST.antifloodCheckDelayMs));
    }

    return { ok: true };
  } catch (err) {
    client.logger?.warn({ err, discordUserId }, 'Falha ao enviar relatório por DM');
    const code = err?.code;
    const base = err?.message || 'Não foi possível abrir canal de mensagem direta.';
    const hint =
      code === 50007
        ? ' Ative mensagens diretas do bot Takahashi Ads nas configurações de privacidade.'
        : '';
    return { ok: false, error: `${base}${hint}` };
  }
}

module.exports = { buildCampaignReport, sendCampaignReportDm, reasonForDelivery };
