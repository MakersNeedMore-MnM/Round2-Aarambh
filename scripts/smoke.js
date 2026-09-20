/**
 * smoke.js — runs the real browser bundles against the real server inside a
 * minimal DOM shim, so render-path exceptions are caught without a browser.
 *
 *   node scripts/smoke.js            (server must be running on PORT, default 3000)
 *
 * This is not a substitute for opening the page. It is a substitute for
 * shipping a page nobody ever executed.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const http = require('http');

const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, '..', 'public');

/* ------------------------------------------------------------- DOM shim */

function makeNode(id, tag) {
  const node = {
    id: id || '', tagName: (tag || 'div').toUpperCase(), children: [], dataset: {},
    _html: '', textContent: '', value: '', placeholder: '', hidden: false, className: '', files: null,
    style: {}, attributes: {},
    get innerHTML() { return this._html; },
    set innerHTML(v) { this._html = String(v); registerFromHtml(this._html); },
    setAttribute(k, v) { this.attributes[k] = String(v); if (k.startsWith('data-')) this.dataset[k.slice(5)] = String(v); },
    getAttribute(k) { return this.attributes[k]; },
    addEventListener() {}, removeEventListener() {}, focus() {}, click() {}, scrollIntoView() {},
    querySelector(sel) { return doc.querySelector(sel); },
    querySelectorAll(sel) { return doc.querySelectorAll(sel); },
    appendChild(c) { this.children.push(c); return c; }
  };
  return node;
}

const registry = new Map();
function registerFromHtml(html) {
  // Elements created inside template strings must be findable afterwards.
  for (const m of html.matchAll(/id="([^"]+)"/g)) {
    if (!registry.has(m[1])) registry.set(m[1], makeNode(m[1]));
  }
}

const doc = {
  documentElement: makeNode('', 'html'),
  body: makeNode('', 'body'),
  visibilityState: 'visible',
  hidden: false,
  getElementById(id) {
    if (!registry.has(id)) registry.set(id, makeNode(id));
    return registry.get(id);
  },
  querySelector(sel) {
    const m = /\[data-tab="([^"]+)"\]/.exec(sel);
    if (m) return doc.getElementById('tab-' + m[1]);
    return makeNode();
  },
  querySelectorAll() { return []; },
  addEventListener() {},
  createElement(tag) { return makeNode('', tag); }
};

/* ------------------------------------------------- window / fetch shim */

const cookieJar = { value: '' };

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? Buffer.from(body) : null;
    const req = http.request({
      host: '127.0.0.1', port: PORT, path: urlPath, method,
      headers: Object.assign(
        payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {},
        cookieJar.value ? { Cookie: cookieJar.value } : {})
    }, (res) => {
      const setCookie = res.headers['set-cookie'];
      if (setCookie) cookieJar.value = setCookie.map((c) => c.split(';')[0]).join('; ');
      let raw = '';
      res.on('data', (d) => { raw += d; });
      res.on('end', () => resolve({
        ok: res.statusCode < 400, status: res.statusCode,
        json: async () => JSON.parse(raw || '{}'), text: async () => raw
      }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const errors = [];

function buildWindow() {
  registry.clear();
  const win = {
    document: doc,
    location: { href: '/', set assign(v) {} },
    console,
    setInterval: () => 0,
    setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0; },
    clearTimeout: () => {},
    fetch: (p, opts) => request((opts && opts.method) || 'GET', p, opts && opts.body),
    speechSynthesis: { speak() {}, cancel() {}, speaking: false, getVoices: () => [] },
    SpeechSynthesisUtterance: function () { return {}; },
    Notification: function () {},
    scrollTo() {},
    FileReader: function () {}
  };
  win.window = win;
  win.Notification.permission = 'default';
  win.Notification.requestPermission = async () => 'denied';
  return win;
}

async function run(page, scripts) {
  const win = buildWindow();
  const ctx = vm.createContext(win);
  // Pre-register the ids that exist in the page markup.
  registerFromHtml(fs.readFileSync(path.join(ROOT, page), 'utf8'));
  for (const s of scripts) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, s), 'utf8'), ctx, { filename: s });
  }
  await new Promise((r) => setTimeout(r, 900));   // let boot() settle
  return win;
}

process.on('unhandledRejection', (e) => errors.push('unhandledRejection: ' + (e && e.message)));
process.on('uncaughtException', (e) => errors.push('uncaughtException: ' + (e && e.message)));

(async () => {
  console.log('Smoke test against http://localhost:' + PORT);

  // Sign in as the elder, then execute the elder bundle.
  cookieJar.value = '';
  await request('POST', '/api/auth/login', JSON.stringify({ email: 'senior@caremate.app', password: 'caremate123' }));
  try {
    const win = await run('senior.html', ['js/i18n.js', 'js/client.js', 'js/senior.js']);
    const next = registry.get('nextCard');
    const meds = registry.get('medList');
    console.log('  senior: nextCard rendered  ', /next__med|done-line/.test(next.innerHTML) ? 'yes' : 'NO');
    console.log('  senior: medicine list rows ', (meds.innerHTML.match(/class="med"/g) || []).length);
    console.log('  senior: care code shown    ', registry.get('careCode').textContent || '(empty)');
    console.log('  senior: topics rendered    ', (registry.get('topicList').innerHTML.match(/class="topic"/g) || []).length);
  } catch (err) { errors.push('senior bundle: ' + err.stack.split('\n').slice(0, 3).join(' | ')); }

  // Sign in as the family member, then execute the caregiver bundle.
  cookieJar.value = '';
  await request('POST', '/api/auth/login', JSON.stringify({ email: 'family@caremate.app', password: 'caremate123' }));
  try {
    await run('family.html', ['js/i18n.js', 'js/client.js', 'js/family.js']);
    const main = registry.get('main');
    console.log('  family: dashboard rendered ', /class="status"/.test(main.innerHTML) ? 'yes' : 'NO');
    console.log('  family: dose rows          ', (main.innerHTML.match(/class="dose"/g) || []).length);
    console.log('  family: timeline nodes     ', (main.innerHTML.match(/class="node/g) || []).length);
    console.log('  family: adherence ring     ', /stroke-dasharray/.test(main.innerHTML) ? 'yes' : 'NO');
  } catch (err) { errors.push('family bundle: ' + err.stack.split('\n').slice(0, 3).join(' | ')); }

  await new Promise((r) => setTimeout(r, 300));
  console.log('');
  if (errors.length) { console.log('FAILURES:'); errors.forEach((e) => console.log('  - ' + e)); process.exit(1); }
  console.log('No runtime errors in either bundle.');
})();
