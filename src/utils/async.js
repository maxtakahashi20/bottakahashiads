function safeAsync(fn) {
  return (...args) => Promise.resolve(fn(...args)).catch((err) => {
    // Rejeições não tratadas matam bots grandes com frequência; centraliza.
    // O handler global também cobre, mas aqui preserva o contexto do evento.
    // eslint-disable-next-line no-console
    console.error(err);
  });
}

module.exports = { safeAsync };

