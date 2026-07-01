const express = require('express');
const path = require('path');
const cors = require("cors");
const db = require('./db');

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.static(__dirname));
app.use(cors());

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

app.get('/api/image/:id', (req, res) => {
  try {
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
