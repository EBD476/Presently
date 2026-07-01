const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const DB_PATH = path.join(__dirname, 'slideshow.sqlite');
const JSON_DB_PATH = path.join(__dirname, 'slideshow.db');

let db = null;

async function init() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  createTables();
  migrateFromJson();

  return db;
}

function createTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS decks (
      name TEXT PRIMARY KEY,
      count INTEGER DEFAULT 1,
      urls TEXT DEFAULT '{}',
      resize TEXT DEFAULT '{}',
      mode TEXT DEFAULT '{}',
      names TEXT DEFAULT '{}',
      bgColors TEXT DEFAULT '{}',
      notes TEXT DEFAULT '{}',
      shapes TEXT DEFAULT '{}',
      starred INTEGER DEFAULT 0,
      lastOpened TEXT,
      modified TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      data TEXT NOT NULL,
      mime TEXT DEFAULT 'image/png'
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);
  save();
}

function migrateFromJson() {
  if (!fs.existsSync(JSON_DB_PATH)) return;

  try {
    const raw = fs.readFileSync(JSON_DB_PATH, 'utf8');
    const data = JSON.parse(raw);

    const existingDecks = db.exec('SELECT COUNT(*) as c FROM decks')[0].values[0][0];
    if (existingDecks > 0) return;

    if (data.decks) {
      const insert = db.prepare(`
        INSERT OR IGNORE INTO decks (name, count, urls, resize, mode, names, bgColors, notes, shapes, starred, lastOpened, modified)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const [name, deck] of Object.entries(data.decks)) {
        insert.run([
          name,
          deck.count || 1,
          JSON.stringify(deck.urls || {}),
          JSON.stringify(deck.resize || {}),
          JSON.stringify(deck.mode || {}),
          JSON.stringify(deck.names || {}),
          JSON.stringify(deck.bgColors || {}),
          JSON.stringify(deck.notes || {}),
          JSON.stringify(deck.shapes || {}),
          deck.starred ? 1 : 0,
          deck.lastOpened || null,
          deck.modified || null
        ]);
      }
      insert.free();
    }

    if (data.images) {
      const insert = db.prepare('INSERT OR IGNORE INTO images (id, data, mime) VALUES (?, ?, ?)');
      for (const [id, img] of Object.entries(data.images)) {
        insert.run([parseInt(id), img.data, img.mime]);
      }
      insert.free();
    }

    if (data.apiUrl) {
      db.run('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['apiUrl', data.apiUrl]);
    }

    save();

    fs.renameSync(JSON_DB_PATH, JSON_DB_PATH + '.bak');
    console.log('Migrated data from slideshow.db to SQLite');
  } catch (err) {
    console.error('Migration error:', err.message);
  }
}

function save() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (sql.trim().toUpperCase().startsWith('SELECT') || sql.trim().toUpperCase().startsWith('WITH')) {
    const results = [];
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }
  stmt.run(params);
  stmt.free();
  save();
  return { changes: db.getRowsModified() };
}

function get(sql, params = []) {
  const results = query(sql, params);
  return results[0] || null;
}

function close() {
  if (db) {
    save();
    db.close();
    db = null;
  }
}

module.exports = { init, query, get, close, save };
