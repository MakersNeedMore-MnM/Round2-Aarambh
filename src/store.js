/**
 * store.js — tiny persistent document store.
 *
 * Why not SQLite/Postgres/Mongo? For a prototype that has to run on any
 * reviewer's machine with `node server.js` and nothing else, a single
 * append-safe JSON file is the honest choice. The access layer below is
 * deliberately shaped like a repository so that swapping in SQLite later
 * touches this file only.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'caremate.json');

const EMPTY = {
  users: [],
  links: [],
  prescriptions: [],
  doses: [],
  reports: [],
  timeline: [],
  alerts: [],
  stories: [],
  sessions: []
};

let db = null;
let writeQueued = false;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  ensureDir();
  if (!fs.existsSync(DB_FILE)) {
    db = JSON.parse(JSON.stringify(EMPTY));
    flush();
    return db;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    db = Object.assign(JSON.parse(JSON.stringify(EMPTY)), parsed);
  } catch (err) {
    // A corrupt store must never take the server down during a demo.
    const backup = DB_FILE + '.corrupt-' + Date.now();
    fs.copyFileSync(DB_FILE, backup);
    console.error('[store] unreadable database, starting fresh. Old file kept at', backup);
    db = JSON.parse(JSON.stringify(EMPTY));
  }
  return db;
}

function flush() {
  ensureDir();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE); // atomic on same filesystem
}

/** Debounced save so a burst of writes costs one disk hit. */
function save() {
  if (writeQueued) return;
  writeQueued = true;
  setTimeout(() => {
    writeQueued = false;
    try { flush(); } catch (err) { console.error('[store] save failed', err); }
  }, 40);
}

function data() {
  if (!db) load();
  return db;
}

function id(prefix) {
  return prefix + '_' + crypto.randomBytes(6).toString('hex');
}

function insert(collection, doc) {
  const row = Object.assign({ id: id(collection.slice(0, 3)), createdAt: new Date().toISOString() }, doc);
  data()[collection].push(row);
  save();
  return row;
}

function find(collection, predicate) {
  return data()[collection].filter(predicate);
}

function findOne(collection, predicate) {
  return data()[collection].find(predicate) || null;
}

function update(collection, rowId, patch) {
  const row = findOne(collection, (r) => r.id === rowId);
  if (!row) return null;
  Object.assign(row, patch, { updatedAt: new Date().toISOString() });
  save();
  return row;
}

function remove(collection, predicate) {
  const bucket = data()[collection];
  const kept = bucket.filter((r) => !predicate(r));
  data()[collection] = kept;
  save();
}

module.exports = { load, save, flush, data, insert, find, findOne, update, remove, id, DB_FILE, DATA_DIR };
