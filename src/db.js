const path = require('path');
const fs = require('fs');

let db = null;
let dbPath = null;

function persist() {
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

async function init(userDataPath) {
  const initSqlJs = require('sql.js');
  dbPath = path.join(userDataPath, 'seohelper.db');

  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS campaign_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      keywords TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS platform_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      photo_id INTEGER REFERENCES campaign_photos(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      caption TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Migrate from legacy store.json if locations table is empty
  const result = db.exec('SELECT COUNT(*) as c FROM locations');
  const count = result[0]?.values[0][0] ?? 0;
  if (count === 0) {
    const legacyPath = path.join(userDataPath, 'store.json');
    try {
      const old = JSON.parse(fs.readFileSync(legacyPath, 'utf8'));
      if (Array.isArray(old.locations) && old.locations.length > 0) {
        const stmt = db.prepare('INSERT INTO locations (name, sort_order) VALUES (?, ?)');
        old.locations.forEach((name, i) => stmt.run([name, i]));
        stmt.free();
      }
    } catch {
      // No legacy store
    }
  }

  persist();
}

function getLocations() {
  if (!db) return [];
  const result = db.exec('SELECT name FROM locations ORDER BY sort_order, id');
  return result[0]?.values.map((r) => r[0]) ?? [];
}

function saveLocations(locations) {
  if (!db) return;
  db.run('DELETE FROM locations');
  const stmt = db.prepare('INSERT INTO locations (name, sort_order) VALUES (?, ?)');
  locations.forEach((name, i) => stmt.run([name, i]));
  stmt.free();
  persist();
}

module.exports = { init, getLocations, saveLocations };
