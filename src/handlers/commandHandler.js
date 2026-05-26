const fs = require('fs');
const path = require('path');

function loadCommands(client, commandsDir) {
  const base = commandsDir || path.join(process.cwd(), 'src', 'commands');
  const entries = walkJsFiles(base);

  for (const file of entries) {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    const cmd = require(file);
    if (!cmd?.data?.name || typeof cmd.execute !== 'function') continue;
    client.commands.set(cmd.data.name, cmd);
  }

  client.logger.info({ commands: client.commands.size }, 'Commands loaded');
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

module.exports = { loadCommands };

