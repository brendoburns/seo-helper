const path = require('path');
const fs = require('fs');

let db = null;

function init(userDataPath) {
  const Database = require('better-sqlite3');
  const dbPath = path.join(userDataPath, 'seohelper.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(userDataPath);
}

function migrate(userDataPath) {
  db.exec(`
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
  const locCount = db.prepare('SELECT COUNT(*) as c FROM locations').get().c;
  if (locCount === 0) {
    const storePath = path.join(userDataPath, 'store.json');
    try {
      const raw = fs.readFileSync(storePath, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data.locations) && data.locations.length > 0) {
        const insert = db.prepare('INSERT INTO locations (name, sort_order) VALUES (?, ?)');
        const insertMany = db.transaction((locs) => {
          locs.forEach((name, i) => insert.run(name, i));
        });
        insertMany(data.locations);
      }
    } catch {
      // No legacy store — nothing to migrate
    }
  }
}

function getLocations() {
  return db.prepare('SELECT name FROM locations ORDER BY sort_order, id').all().map((r) => r.name);
}

function saveLocations(locations) {
  const clear = db.prepare('DELETE FROM locations');
  const insert = db.prepare('INSERT INTO locations (name, sort_order) VALUES (?, ?)');
  const run = db.transaction((locs) => {
    clear.run();
    locs.forEach((name, i) => insert.run(name, i));
  });
  run(locations);
}

module.exports = { init, getLocations, saveLocations };
