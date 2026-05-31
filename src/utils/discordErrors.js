/**
 * Mensagens de erro formais (PT-BR) — código Discord quando existir.
 */

const CODE_MESSAGES = {
  0: 'Erro geral da API.',
  10003: 'Usuário ou canal não encontrado.',
  10004: 'Canal inexistente ou removido.',
  10007: 'Usuário desconhecido.',
  10013: 'Mensagem não encontrada.',
  20009: 'Limite de mensagens diretas atingido nesta conta.',
  20026: 'Conta desativada ou restrita pelo Discord. Verifique o e-mail da conta antes de continuar.',
  40001: 'Token não autorizado. Gere um novo token da conta.',
  40002: 'Verificação em duas etapas exigida nesta conta.',
  50001: 'Sem acesso ao canal ou ao servidor.',
  50007: 'Destinatário com mensagens diretas desativadas.',
  50013: 'Sem permissão para enviar neste canal.',
  50033: 'Conteúdo da mensagem inválido para o Discord.',
  50109: 'Corpo da requisição inválido. Revise o TOKEN (uma linha, sem aspas) e o texto enviado.',
  60003: 'Sessão expirada. Atualize o TOKEN da conta.',
  60005: 'Conta sem permissão para esta ação.'
};

const CONTEXT_HINTS = {
  token_validate: 'Validação do TOKEN no modal.',
  friends_list: 'Listagem de amigos da conta.',
  guild_members: 'Listagem de membros do servidor.',
  dm_open: 'Abertura do canal de mensagem direta.',
  dm_send: 'Envio da mensagem direta.',
  channel_send: 'Envio no canal de divulgação.',
  report_dm: 'Envio do relatório na sua DM.',
  modal: 'Processamento do formulário.',
  cooldown: 'Intervalo entre campanhas.'
};

/**
 * @param {number} status HTTP
 * @param {object|null} data corpo JSON do Discord
 * @param {string} [context] chave de CONTEXT_HINTS
 */
function formatDiscordApiError(status, data = null, context = null) {
  const code = data?.code;
  const apiMsg = data?.message ? String(data.message).trim() : null;
  const codeLine = code != null ? `Código Discord: **${code}**.` : null;
  const known = code != null ? CODE_MESSAGES[code] : null;

  let main;
  if (known) {
    main = known;
  } else if (status === 401) {
    main = 'TOKEN recusado (não autorizado ou expirado).';
  } else if (status === 403) {
    main = 'Acesso negado pela API do Discord.';
  } else if (status === 404) {
    main = 'Recurso não encontrado (ID ou canal incorreto).';
  } else if (status === 429) {
    const sec = data?.retry_after ? Math.ceil(Number(data.retry_after)) : null;
    main = sec
      ? `Limite de requisições atingido. Aguarde **${sec}s** antes de repetir.`
      : 'Limite de requisições atingido. Aguarde alguns minutos.';
  } else if (status >= 500) {
    main = 'Falha temporária nos servidores do Discord.';
  } else if (apiMsg) {
    main = apiMsg;
  } else {
    main = `Falha na comunicação com o Discord (HTTP ${status}).`;
  }

  const ctx = context && CONTEXT_HINTS[context] ? `Contexto: ${CONTEXT_HINTS[context]}` : null;
  const detail = apiMsg && known && apiMsg !== known ? `Detalhe API: ${apiMsg}` : null;

  return [main, codeLine, detail, ctx].filter(Boolean).join('\n');
}

/**
 * @param {Error|object|string} err
 * @param {string} [context]
 */
function formatCaughtError(err, context = 'modal') {
  if (!err) return 'Falha não identificada. Consulte os logs do bot.';

  const status = err?.status ?? err?.rawError?.status;
  const data = err?.raw ?? err?.rawError ?? (err?.code != null ? { code: err.code, message: err.message } : null);
  if (status || data?.code) {
    return formatDiscordApiError(status || 0, data, context);
  }

  const msg = String(err?.message || err).trim();
  if (/token/i.test(msg) && /inválid|expirad|401/i.test(msg)) {
    return formatDiscordApiError(401, { code: 40001 }, 'token_validate');
  }
  if (/50007|cannot send messages/i.test(msg)) {
    return CODE_MESSAGES[50007];
  }
  if (msg.length > 0 && msg.length < 500) {
    const ctx = CONTEXT_HINTS[context] ? `\nContexto: ${CONTEXT_HINTS[context]}` : '';
    return `${msg}${ctx}`;
  }

  return `Falha interna ao processar a operação.\nContexto: ${CONTEXT_HINTS[context] || context}.`;
}

/**
 * Resposta curta para editReply (com prefixo).
 */
function userFacingError(text, { title = 'Não foi possível concluir' } = {}) {
  return `**${title}**\n${text}`;
}

/**
 * @param {object} result retorno de sendDmAsUser / API
 */
function formatDeliveryFailure(result) {
  if (!result) return 'Falha no envio (resposta vazia).';
  if (result.skipped) return null;
  return formatDiscordApiError(result.status, {
    code: result.code,
    message: result.error,
    retry_after: result.retryAfterSec
  }, 'dm_send');
}

module.exports = {
  CODE_MESSAGES,
  formatDiscordApiError,
  formatCaughtError,
  formatDeliveryFailure,
  userFacingError
};
