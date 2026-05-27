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

function dbErrorMessage(err, fallback = 'Erro no banco de dados.') {
  if (isMissingTableError(err)) {
    return '⚠️ Tabelas SaaS ausentes. Rode `prisma/migrations/saas_licensing.sql` e `saas_licensing_step5.sql` no Supabase.';
  }
  if (isSchemaMismatchError(err)) {
    return '⚠️ Banco desatualizado. Execute `saas_licensing_step5.sql` no Supabase e reinicie o bot.';
  }
  return `${fallback} (${err?.message || err})`;
}

module.exports = { isMissingTableError, isSchemaMismatchError, dbErrorMessage };
