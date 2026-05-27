function fmtDate(d) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(d));
}

function fmtDurationMinutes(start, end) {
  const endMs = end ? new Date(end).getTime() : Date.now();
  const min = (endMs - new Date(start).getTime()) / 60_000;
  return min < 0.1 ? '0.0' : min.toFixed(1);
}

function maskSecret(value, visible = 6) {
  if (!value) return '—';
  const s = String(value);
  if (s.length <= visible) return `${s}…`;
  return `${s.slice(0, visible)}…`;
}

module.exports = { fmtDate, fmtDurationMinutes, maskSecret };
