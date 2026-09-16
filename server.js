// Copyright (c) 2026 Nexora Labs. All rights reserved.
// Contact: thenexoralabstoday@gmail.com

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || 3000;
const ROOT = path.resolve('.');
const CONTACT_FILE = path.join(ROOT, 'data', 'contact.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
};

function ensureDataDir() {
  const dir = path.dirname(CONTACT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readContact() {
  ensureDataDir();
  if (!fs.existsSync(CONTACT_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(CONTACT_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeContact(arr) {
  ensureDataDir();
  fs.writeFileSync(CONTACT_FILE, JSON.stringify(arr, null, 2));
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type });
  res.end(body);
}

const NOT_FOUND = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>Not found — Nexora Labs</title>
<style>html{background:#05080e;color:#a9bacb;font:16px/1.6 system-ui,sans-serif}
body{display:grid;place-content:center;gap:12px;min-height:100vh;margin:0;padding:24px;text-align:center}
h1{color:#e9f1f7;font-size:clamp(28px,6vw,44px);letter-spacing:-.03em;margin:0}
a{color:#00e5a0}</style></head>
<body><h1>404</h1><p>That page isn't in the forge.</p>
<p><a href="/">Return to Nexora Labs</a></p></body></html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // ── Contact API ──────────────────────────────────────────────────────
  if (url.pathname === '/api/contact') {
    if (req.method !== 'POST') {
      res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' });
      return res.end(JSON.stringify({ error: 'Method not allowed' }));
    }

    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Refuse absurd payloads rather than buffering them.
      if (body.length > 1e5) req.destroy();
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const entry = {
          name: String(data.name || '').slice(0, 200),
          email: String(data.email || '').slice(0, 200),
          message: String(data.message || '').slice(0, 5000),
          receivedAt: new Date().toISOString(),
        };

        if (!entry.name || !entry.email || !entry.message) {
          return send(res, 400, 'application/json', JSON.stringify({ error: 'Missing fields' }));
        }

        const arr = readContact();
        arr.push(entry);
        writeContact(arr);
        send(res, 200, 'application/json', JSON.stringify({ ok: true }));
      } catch {
        send(res, 400, 'application/json', JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // ── Static files ─────────────────────────────────────────────────────
  let pathname;
  try {
    // Decode so directories containing spaces (e.g. "PDF editor") resolve.
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send(res, 400, 'text/plain; charset=utf-8', 'Bad request');
  }

  if (pathname.endsWith('/')) pathname += 'index.html';
  if (!path.extname(pathname)) pathname += '.html';

  const fullPath = path.join(ROOT, pathname);

  // Keep every request inside the project directory.
  if (fullPath !== ROOT && !fullPath.startsWith(ROOT + path.sep)) {
    return send(res, 403, 'text/plain; charset=utf-8', 'Forbidden');
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT' || err.code === 'EISDIR') {
        return send(res, 404, 'text/html; charset=utf-8', NOT_FOUND);
      }
      return send(res, 500, 'text/plain; charset=utf-8', 'Server error');
    }

    const headers = { 'Content-Type': contentType };

    // Fingerprint-free build, so cache assets briefly and revalidate pages.
    if (pathname.startsWith('/assets/')) {
      headers['Cache-Control'] = 'public, max-age=86400';
    } else if (ext === '.html') {
      headers['Cache-Control'] = 'no-cache';
    }

    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`Nexora Labs website running at http://localhost:${PORT}`);
});
