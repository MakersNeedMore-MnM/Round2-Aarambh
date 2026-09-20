/**
 * CareMate — server entry point.
 *
 * Deliberately dependency-free: Node's own http/fs/crypto only. The whole
 * project runs with `node server.js` on any machine with Node 18+, with no
 * install step, no build step, no network access and no API keys. For a
 * prototype that has to survive being opened by a reviewer on a locked-down
 * laptop, that reliability is worth more than a framework.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const store = require('./src/store');
const auth = require('./src/auth');
const api = require('./src/api');
const scheduler = require('./src/scheduler');
const seed = require('./scripts/seed');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2'
};

store.load();
seed.ensureDemoData();
scheduler.start();

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsed.pathname);

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (pathname.startsWith('/api/')) return handleApi(req, res, pathname, parsed.query);
  return serveStatic(req, res, pathname);
});

async function handleApi(req, res, pathname, query) {
  const cookies = [];
  try {
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readJson(req) : null;
    const ctx = {
      req, res, method: req.method, path: pathname, query, body,
      user: auth.userFromRequest(req),
      setCookie: (c) => cookies.push(c)
    };
    const payload = await api.handle(ctx);
    send(res, 200, payload, cookies);
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[api]', req.method, pathname, err);
    send(res, status, { error: err.message || 'Something went wrong on our side.' }, cookies);
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let tooBig = false;
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) { tooBig = true; req.destroy(); }
    });
    req.on('end', () => {
      if (tooBig) return reject(Object.assign(new Error('That file is too large. Keep uploads under 2 MB.'), { status: 413 }));
      if (!raw) return resolve(null);
      try { resolve(JSON.parse(raw)); }
      catch { reject(Object.assign(new Error('The request could not be read.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload, cookies) {
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (cookies && cookies.length) headers['Set-Cookie'] = cookies;
  res.writeHead(status, headers);
  res.end(body);
}

function serveStatic(req, res, pathname) {
  let rel = pathname === '/' ? '/index.html' : pathname;
  if (!path.extname(rel)) rel += '.html';

  const filePath = path.join(PUBLIC_DIR, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset="utf-8"><title>Page not found</title>' +
        '<body style="font-family:system-ui;padding:3rem;max-width:32rem"><h1>This page is not here</h1>' +
        '<p>The address may have been typed differently. <a href="/">Go back to the start</a>.</p>');
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

server.listen(PORT, () => {
  console.log('');
  console.log('  CareMate is running');
  console.log('  ──────────────────────────────────────────────');
  console.log(`  Open:      http://localhost:${PORT}`);
  console.log('  Senior:    senior@caremate.app    / caremate123');
  console.log('  Family:    family@caremate.app    / caremate123');
  console.log('  Data file: ' + store.DB_FILE);
  console.log('');
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    // The store batches writes, so an unflushed change would otherwise be
    // lost when the process is stopped a moment after a request.
    try { store.flush(); } catch {}
    console.log('\n  CareMate stopped. Data saved.');
    process.exit(0);
  });
}
