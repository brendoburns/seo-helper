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
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT DEFAULT 'Dumpster Rental',
      phone TEXT DEFAULT '',
      website TEXT DEFAULT '',
      tone TEXT DEFAULT 'Friendly',
      is_active INTEGER DEFAULT 0
    );

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

function getSettings() {
  if (!db) return {};
  const result = db.exec('SELECT key, value FROM settings');
  if (!result[0]) return {};
  return Object.fromEntries(result[0].values.map(([k, v]) => [k, v]));
}

function saveSettings(settings) {
  if (!db) return;
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  Object.entries(settings).forEach(([k, v]) => stmt.run([k, v ?? '']));
  stmt.free();
  persist();
}

function getBusinesses() {
  if (!db) return [];
  const result = db.exec('SELECT id, name, type, phone, website, tone, is_active FROM businesses ORDER BY id');
  if (!result[0]) return [];
  return result[0].values.map(([id, name, type, phone, website, tone, is_active]) => ({
    id, name, type, phone, website, tone, isActive: !!is_active,
  }));
}

function saveBusiness(business) {
  if (!db) return null;
  if (business.id) {
    db.run(
      'UPDATE businesses SET name=?, type=?, phone=?, website=?, tone=? WHERE id=?',
      [business.name, business.type, business.phone, business.website, business.tone, business.id]
    );
    persist();
    return business.id;
  } else {
    db.run(
      'INSERT INTO businesses (name, type, phone, website, tone) VALUES (?, ?, ?, ?, ?)',
      [business.name, business.type || 'Dumpster Rental', business.phone || '', business.website || '', business.tone || 'Friendly']
    );
    persist();
    const res = db.exec('SELECT last_insert_rowid()');
    return res[0].values[0][0];
  }
}

function deleteBusiness(id) {
  if (!db) return;
  db.run('DELETE FROM businesses WHERE id=?', [id]);
  // If we just deleted the active one, activate the first remaining
  const res = db.exec('SELECT COUNT(*) FROM businesses WHERE is_active=1');
  if (res[0].values[0][0] === 0) {
    db.run('UPDATE businesses SET is_active=1 WHERE id=(SELECT MIN(id) FROM businesses)');
  }
  persist();
}

function setActiveBusiness(id) {
  if (!db) return;
  db.run('UPDATE businesses SET is_active=0');
  db.run('UPDATE businesses SET is_active=1 WHERE id=?', [id]);
  persist();
}

module.exports = {
  init,
  getLocations, saveLocations,
  getSettings, saveSettings,
  getBusinesses, saveBusiness, deleteBusiness, setActiveBusiness,
};
