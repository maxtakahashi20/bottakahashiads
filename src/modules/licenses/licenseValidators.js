const { LICENSE_CODE_REGEX } = require('../../config/licensing');

/**
 * Valida formato antes de consultar o banco (anti código falso / bypass).
 * @param {string} raw
 */
function validateLicenseFormat(raw) {
  const code = String(raw || '').trim();
  if (!code) {
    return { ok: false, error: 'Informe o código da licença.' };
  }
  if (code.length > 64) {
    return { ok: false, error: 'Código inválido.' };
  }
  if (!LICENSE_CODE_REGEX.test(code)) {
    return {
      ok: false,
      error: 'Formato inválido. Use: `takahashi-store-` + 7 a 12 letras/números.'
    };
  }
  return { ok: true, code };
}

module.exports = { validateLicenseFormat };
