const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require("cors");

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.static(__dirname));
app.use(cors());

const DB_PATH = path.join(__dirname, 'slideshow.db');

function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch (_) {}
  return { decks: {}, images: {} };
}

function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

function convertDataUrls(urls, imageMap) {
  let nextId = Object.keys(imageMap).reduce((max, id) => Math.max(max, parseInt(id)), 0) + 1;
  for (const [idx, url] of Object.entries(urls)) {
    if (typeof url === 'string' && url.startsWith('data:')) {
      const commaIdx = url.indexOf(',');
      const header = url.substring(0, commaIdx);
      const base64Data = url.substring(commaIdx + 1);
      const mime = header.split(':')[1].split(';')[0] || 'image/png';
      const imgId = nextId++;
      imageMap[imgId] = { data: base64Data, mime };
      urls[idx] = `/api/image/${imgId}`;
    }
  }
  return imageMap;
}

app.get('/api/decks', (req, res) => {
  try {
    const db = loadDb();
    const decks = db.decks || {};
    const list = Object.keys(decks).map(name => {
      const d = decks[name];
      let firstImage = '';
      const urls = d.urls || {};
      for (let i = 0; i < (d.count || 1); i++) {
        if (urls[i]) { firstImage = urls[i]; break; }
      }
      return { name, count: d.count || 1, firstImage, lastOpened: d.lastOpened || null, modified: d.modified || null, starred: !!d.starred };
    });
    res.json({ decks: list });
  } catch (err) {
    console.error('GET /api/decks:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/data/:deckName', (req, res) => {
  try {
    const db = loadDb();
    const name = decodeURIComponent(req.params.deckName);
    const deck = (db.decks || {})[name];
      if (!deck) return res.json({ kv: { count: 1, urls: {}, resize: {}, mode: {}, names: {}, bgColors: {}, notes: {} } });
    deck.lastOpened = new Date().toISOString();
    saveDb(db);
    res.json({ kv: { ...deck, apiUrl: db.apiUrl || '' } });
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

    const db = loadDb();
    const decks = db.decks || {};
    const imageMap = db.images || {};

    const urls = kv.urls || {};
    convertDataUrls(urls, imageMap);

    kv.urls = urls;
    decks[name] = {
      count: kv.count || 1,
      urls: kv.urls || {},
      resize: kv.resize || {},
      mode: kv.mode || {},
      names: kv.names || {},
      bgColors: kv.bgColors || {},
      notes: kv.notes || {},
      starred: false,
      lastOpened: new Date().toISOString(),
      modified: new Date().toISOString()
    };
    db.decks = decks;
    db.images = imageMap;
    if (kv.apiUrl) db.apiUrl = kv.apiUrl;
    saveDb(db);

    res.json({ ok: true, kv: { ...decks[name], apiUrl: db.apiUrl || '' } });
  } catch (err) {
    console.error('POST /api/data/:deckName:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/data/:deckName', (req, res) => {
  try {
    const db = loadDb();
    const name = decodeURIComponent(req.params.deckName);
    delete (db.decks || {})[name];
    saveDb(db);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/upload', (req, res) => {
  try {
    const { data, mime } = req.body;
    if (!data) return res.status(400).json({ error: 'No image data' });
    const db = loadDb();
    const imageMap = db.images || {};
    const imgId = Object.keys(imageMap).reduce((max, id) => Math.max(max, parseInt(id)), 0) + 1;
    imageMap[imgId] = { data, mime: mime || 'image/png' };
    db.images = imageMap;
    saveDb(db);
    res.json({ id: imgId, url: `/api/image/${imgId}` });
  } catch (err) {
    console.error('POST /api/upload:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/image/:id', (req, res) => {
  try {
    const db = loadDb();
    const images = db.images || {};
    const img = images[parseInt(req.params.id)];
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
    saveDb({ kv: {}, images: {} });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/star/:deckName', (req, res) => {
  try {
    const db = loadDb();
    const name = decodeURIComponent(req.params.deckName);
    const deck = (db.decks || {})[name];
    if (!deck) return res.status(404).json({ error: 'Deck not found' });
    deck.starred = !deck.starred;
    saveDb(db);
    res.json({ ok: true, starred: deck.starred });
  } catch (err) {
    console.error('PATCH /api/star/:deckName:', err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Slideshow server running at http://localhost:${PORT}`);
});
