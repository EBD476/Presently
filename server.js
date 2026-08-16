const express = require('express');
const path = require('path');
const cors = require("cors");
const crypto = require('crypto');
const db = require('./db');

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.static(__dirname));
app.use(cors());

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const created = new Date().toISOString();
  const expires = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.query('INSERT INTO sessions (token, user_id, created, expires) VALUES (?, ?, ?, ?)', [token, userId, created, expires]);
  return token;
}

function getTokenFromReq(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  if (req.query.auth) return req.query.auth;
  return null;
}

function getUserFromToken(token) {
  if (!token) return null;
  const row = db.get('SELECT * FROM sessions WHERE token = ?', [token]);
  if (!row) return null;
  if (new Date(row.expires).getTime() < Date.now()) {
    db.query('DELETE FROM sessions WHERE token = ?', [token]);
    return null;
  }
  return db.get('SELECT id, username, email, created, lastLogin FROM users WHERE id = ?', [row.user_id]);
}

function requireAuth(req, res, next) {
  const user = getUserFromToken(getTokenFromReq(req));
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  req.user = user;
  next();
}

// Protect all /api routes except auth + media (media validates its own token so <img> works)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/') || req.path.startsWith('/image/')) return next();
  return requireAuth(req, res, next);
});

app.post('/api/auth/register', (req, res) => {
  try {
    const { username, password, email } = req.body;
    const name = String(username || '').trim();
    if (name.length < 3 || name.length > 40) {
      return res.status(400).json({ error: 'username_length' });
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(name)) {
      return res.status(400).json({ error: 'username_chars' });
    }
    if (!password || String(password).length < 6) {
      return res.status(400).json({ error: 'password_short' });
    }
    if (db.get('SELECT id FROM users WHERE username = ?', [name])) {
      return res.status(409).json({ error: 'username_taken' });
    }
    const now = new Date().toISOString();
    const cleanEmail = String(email || '').trim().slice(0, 200) || null;
    db.query('INSERT INTO users (username, email, password_hash, created, lastLogin) VALUES (?, ?, ?, ?, ?)',
      [name, cleanEmail, hashPassword(password), now, now]);
    const user = db.get('SELECT id, username, email, created, lastLogin FROM users WHERE username = ?', [name]);
    const token = createSession(user.id);
    res.json({ token, user });
  } catch (err) {
    console.error('POST /api/auth/register:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const name = String(username || '').trim();
    const user = db.get('SELECT * FROM users WHERE username = ?', [name]);
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const now = new Date().toISOString();
    db.query('UPDATE users SET lastLogin = ? WHERE id = ?', [now, user.id]);
    const token = createSession(user.id);
    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email, created: user.created, lastLogin: now }
    });
  } catch (err) {
    console.error('POST /api/auth/login:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/logout', (req, res) => {
  try {
    const token = getTokenFromReq(req);
    if (token) db.query('DELETE FROM sessions WHERE token = ?', [token]);
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/auth/logout:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', (req, res) => {
  const user = getUserFromToken(getTokenFromReq(req));
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  res.json({ user });
});

function convertDataUrls(urls) {
  let maxId = db.get('SELECT COALESCE(MAX(id), 0) as m FROM images');
  let nextId = (maxId?.m || 0) + 1;
  for (const [idx, url] of Object.entries(urls)) {
    if (typeof url === 'string' && url.startsWith('data:')) {
      const commaIdx = url.indexOf(',');
      const header = url.substring(0, commaIdx);
      const base64Data = url.substring(commaIdx + 1);
      const mime = header.split(':')[1].split(';')[0] || 'image/png';
      const imgId = nextId++;
      db.query('INSERT INTO images (id, data, mime) VALUES (?, ?, ?)', [imgId, base64Data, mime]);
      urls[idx] = `/api/image/${imgId}`;
    }
  }
}

app.get('/api/decks', (req, res) => {
  try {
    const rows = db.query('SELECT * FROM decks ORDER BY name');
    const list = rows.map(d => {
      let firstImage = '';
      const urls = JSON.parse(d.urls || '{}');
      for (let i = 0; i < (d.count || 1); i++) {
        if (urls[i]) { firstImage = urls[i]; break; }
      }
      return {
        name: d.name,
        count: d.count || 1,
        firstImage,
        lastOpened: d.lastOpened || null,
        modified: d.modified || null,
        starred: !!d.starred
      };
    });
    res.json({ decks: list });
  } catch (err) {
    console.error('GET /api/decks:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/data/:deckName', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.deckName);
    let deck = db.get('SELECT * FROM decks WHERE name = ?', [name]);
    if (!deck) {
      return res.json({ kv: { count: 1, urls: {}, resize: {}, mode: {}, names: {}, bgColors: {}, notes: {} } });
    }
    db.query('UPDATE decks SET lastOpened = ? WHERE name = ?', [new Date().toISOString(), name]);
    const config = db.get('SELECT value FROM config WHERE key = ?', ['apiUrl']);
    const apiUrl = config?.value || '';
    res.json({
      kv: {
        count: deck.count,
        urls: JSON.parse(deck.urls || '{}'),
        resize: JSON.parse(deck.resize || '{}'),
        mode: JSON.parse(deck.mode || '{}'),
        names: JSON.parse(deck.names || '{}'),
        bgColors: JSON.parse(deck.bgColors || '{}'),
        notes: JSON.parse(deck.notes || '{}'),
        shapes: JSON.parse(deck.shapes || '{}'),
        starred: !!deck.starred,
        lastOpened: deck.lastOpened,
        modified: deck.modified,
        apiUrl
      }
    });
  } catch (err) {
    console.error('GET /api/data/:deckName:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/data/:deckName', (req, res) => {
  try {
    const { kv } = req.body;
    if (!kv || typeof kv !== 'object') {
      return res.status(400).json({ error: 'Invalid data' });
    }
    const name = decodeURIComponent(req.params.deckName);

    const urls = kv.urls || {};
    convertDataUrls(urls);

    const now = new Date().toISOString();
    db.query(`
      INSERT INTO decks (name, count, urls, resize, mode, names, bgColors, notes, shapes, lastOpened, modified)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        count = excluded.count,
        urls = excluded.urls,
        resize = excluded.resize,
        mode = excluded.mode,
        names = excluded.names,
        bgColors = excluded.bgColors,
        notes = excluded.notes,
        shapes = excluded.shapes,
        modified = excluded.modified
    `, [
      name,
      kv.count || 1,
      JSON.stringify(urls),
      JSON.stringify(kv.resize || {}),
      JSON.stringify(kv.mode || {}),
      JSON.stringify(kv.names || {}),
      JSON.stringify(kv.bgColors || {}),
      JSON.stringify(kv.notes || {}),
      JSON.stringify(kv.shapes || {}),
      now,
      now
    ]);

    if (kv.apiUrl) {
      db.query('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)', ['apiUrl', kv.apiUrl]);
    }

    const config = db.get('SELECT value FROM config WHERE key = ?', ['apiUrl']);
    const apiUrl = config?.value || '';

    res.json({ ok: true, kv: { ...kv, urls, apiUrl } });
  } catch (err) {
    console.error('POST /api/data/:deckName:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/data/:deckName', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.deckName);
    db.query('DELETE FROM decks WHERE name = ?', [name]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', (req, res) => {
  try {
    const { data, mime } = req.body;
    if (!data) return res.status(400).json({ error: 'No image data' });
    const result = db.query('INSERT INTO images (data, mime) VALUES (?, ?)', [data, mime || 'image/png']);
    const id = db.get('SELECT MAX(id) as id FROM images');
    res.json({ id: id.id, url: `/api/image/${id.id}` });
  } catch (err) {
    console.error('POST /api/upload:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/shapes', (req, res) => {
  try {
    const rows = db.query('SELECT * FROM shape_library ORDER BY name');
    const shapes = {};
    for (const row of rows) {
      shapes[row.name] = JSON.parse(row.data);
    }
    res.json({ shapes });
  } catch (err) {
    console.error('GET /api/shapes:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/shapes', (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) return res.status(400).json({ error: 'Name and data required' });
    const now = new Date().toISOString();
    const existing = db.get('SELECT * FROM shape_library WHERE name = ?', [name]);
    if (existing) {
      db.query('UPDATE shape_library SET data = ?, modified = ? WHERE name = ?', [JSON.stringify(data), now, name]);
    } else {
      db.query('INSERT INTO shape_library (name, data, created, modified) VALUES (?, ?, ?, ?)', [name, JSON.stringify(data), now, now]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/shapes:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/shapes/:name', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    db.query('DELETE FROM shape_library WHERE name = ?', [name]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/shapes/:name:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/templates', (req, res) => {
  try {
    const rows = db.query('SELECT * FROM slide_templates ORDER BY name');
    const templates = {};
    for (const row of rows) {
      templates[row.name] = JSON.parse(row.data);
    }
    res.json({ templates });
  } catch (err) {
    console.error('GET /api/templates:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/templates', (req, res) => {
  try {
    const { name, data } = req.body;
    if (!name || !data) return res.status(400).json({ error: 'Name and data required' });
    const now = new Date().toISOString();
    const existing = db.get('SELECT * FROM slide_templates WHERE name = ?', [name]);
    if (existing) {
      db.query('UPDATE slide_templates SET data = ?, modified = ? WHERE name = ?', [JSON.stringify(data), now, name]);
    } else {
      db.query('INSERT INTO slide_templates (name, data, created, modified) VALUES (?, ?, ?, ?)', [name, JSON.stringify(data), now, now]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/templates:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/templates/:name', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name);
    db.query('DELETE FROM slide_templates WHERE name = ?', [name]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/templates/:name:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/image/:id', (req, res) => {
  try {
    if (!getUserFromToken(getTokenFromReq(req))) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const img = db.get('SELECT * FROM images WHERE id = ?', [parseInt(req.params.id)]);
    if (!img) {
      return res.status(404).json({ error: 'Image not found' });
    }
    const buf = Buffer.from(img.data, 'base64');
    res.setHeader('Content-Type', img.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.send(buf);
  } catch (err) {
    console.error('GET /api/image/:id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/data', (req, res) => {
  try {
    db.query('DELETE FROM decks');
    db.query('DELETE FROM images');
    db.query('DELETE FROM config');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/star/:deckName', (req, res) => {
  try {
    const name = decodeURIComponent(req.params.deckName);
    const deck = db.get('SELECT * FROM decks WHERE name = ?', [name]);
    if (!deck) return res.status(404).json({ error: 'Deck not found' });
    const newStarred = deck.starred ? 0 : 1;
    db.query('UPDATE decks SET starred = ? WHERE name = ?', [newStarred, name]);
    res.json({ ok: true, starred: !!newStarred });
  } catch (err) {
    console.error('PATCH /api/star/:deckName:', err);
    res.status(500).json({ error: err.message });
  }
});

async function start() {
  await db.init();
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`Slideshow server running at http://localhost:${PORT}`);
  });
}

start();
