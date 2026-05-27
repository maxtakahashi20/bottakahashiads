const { ActivityType } = require('discord.js');

class StatusService {
  /**
   * @param {import('../structures/ExtendedClient').ExtendedClient} client
   */
  constructor(client) {
    this.client = client;
    this.timer = null;
    this.idx = 0;
    this.messages = [
      () => `🌐 Rede de anúncios: ${this.client.guilds.cache.size} servidores`,
      () => `/painel • /setup-ads • canais de parceria`,
      () => `Parcerias • FiveM • RP • Gaming`,
      () => `Powered by Takahashi Network`
    ];
  }

  start() {
    if (this.timer) return;
    const tick = () => {
      const msg = this.messages[this.idx % this.messages.length]();
      this.idx += 1;
      this.client.user.setPresence({
        activities: [{ name: msg, type: ActivityType.Watching }],
        status: 'online'
      });
    };
    tick();
    this.timer = setInterval(tick, 25_000);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = { StatusService };

