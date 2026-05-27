/** Tabela ausente no Supabase (migration não rodada) */
function isMissingTableError(err) {
  return err?.code === 'P2021' || /does not exist/i.test(String(err?.message));
}

module.exports = { isMissingTableError };
