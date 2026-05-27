/**
 * Renovação de assinatura (integração de pagamento futura).
 * Hoje estende o período via licença admin (/renovar).
 */
class RenewalService {
  /**
   * @param {import('../../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
  }

  /**
   * @param {string} tenantId
   * @param {number} extraDays
   */
  async extendByDays(tenantId, extraDays) {
    return this.client.services.subscriptions.extendActive(tenantId, extraDays);
  }
}

module.exports = { RenewalService };
