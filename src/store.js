const fs = require('fs/promises');
const path = require('path');

let storePath = null;

function init(userDataPath) {
  storePath = path.join(userDataPath, 'store.json');
}

async function read() {
  try {
    const raw = await fs.readFile(storePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function write(data) {
  await fs.writeFile(storePath, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = { init, read, write };
