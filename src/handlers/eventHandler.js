const fs = require('fs');
const path = require('path');

function loadEvents(client, eventsDir) {
  const base = eventsDir || path.join(process.cwd(), 'src', 'events');
  const files = walkJsFiles(base);

  for (const file of files) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const evt = require(file);
    if (!evt?.name || typeof evt.execute !== 'function') continue;
    if (evt.once) client.once(evt.name, (...args) => evt.execute(client, ...args));
    else client.on(evt.name, (...args) => evt.execute(client, ...args));
  }

  client.logger.info({ events: files.length }, 'Events loaded');
}

function walkJsFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) out.push(...walkJsFiles(p));
    else if (it.isFile() && it.name.endsWith('.js')) out.push(p);
  }
  return out;
}

module.exports = { loadEvents };

