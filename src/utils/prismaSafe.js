/** Tabela ausente no Supabase (migration não rodada) */
function isMissingTableError(err) {
  return err?.code === 'P2021' || /does not exist/i.test(String(err?.message));
}

/** Schema Prisma desatualizado vs banco (unique composto, coluna tenantId, etc.) */
function isSchemaMismatchError(err) {
  const msg = String(err?.message || '');
  return (
    isMissingTableError(err) ||
    err?.code === 'P2022' ||
    /tenantId_guildId|tenantId_slot|Unknown argument/i.test(msg)
  );
}

function isUniqueConstraintError(err, field) {
  if (err?.code !== 'P2002') return false;
  const target = err?.meta?.target;
  if (!field) return true;
  if (Array.isArray(target)) return target.includes(field);
  return String(target || '').includes(field);
}

function dbErrorMessage(err, fallback = 'Erro no banco de dados.') {
  if (isMissingTableError(err)) {
    return '⚠️ Tabelas SaaS ausentes. Rode `prisma/migrations/saas_licensing.sql` e `saas_licensing_step5.sql` no Supabase.';
  }
  if (isSchemaMismatchError(err)) {
    return '⚠️ Banco desatualizado. Execute `saas_licensing_step5.sql` no Supabase e reinicie o bot.';
  }
  if (isUniqueConstraintError(err, 'ownerUserId')) {
    return 'Você já possui um ambiente registrado. Use `/renovar` ou contate o suporte.';
  }
  if (isUniqueConstraintError(err)) {
    return fallback;
  }
  return fallback;
}

module.exports = {
  isMissingTableError,
  isSchemaMismatchError,
  isUniqueConstraintError,
  dbErrorMessage
};
