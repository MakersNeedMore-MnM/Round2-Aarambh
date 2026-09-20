/**
 * auth.js — accounts and sessions.
 * Passwords are salted and hashed with scrypt; comparisons are constant-time.
 * Sessions are opaque random tokens held server-side in the store, delivered
 * as an HttpOnly, SameSite=Lax cookie.
 */
const crypto = require('crypto');
const store = require('./store');

const SESSION_DAYS = 14;
const COOKIE = 'caremate_sid';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, expected] = stored.split(':');
  const derived = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expected, 'hex');
  if (expectedBuf.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function createUser({ name, email, password, role, language }) {
  const normalised = String(email).trim().toLowerCase();
  if (store.findOne('users', (u) => u.email === normalised)) {
    const err = new Error('An account already exists for this email.');
    err.status = 409;
    throw err;
  }
  return store.insert('users', {
    name: String(name).trim(),
    email: normalised,
    password: hashPassword(password),
    role: role === 'caregiver' ? 'caregiver' : 'senior',
    language: language === 'hi' ? 'hi' : 'en',
    inviteCode: role === 'caregiver' ? null : makeInviteCode()
  });
}

function makeInviteCode() {
  // Readable over a phone call: no 0/O, no 1/I.
  const alphabet = 'ACDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
  if (store.findOne('users', (u) => u.inviteCode === code)) return makeInviteCode();
  return code;
}

function authenticate(email, password) {
  const user = store.findOne('users', (u) => u.email === String(email).trim().toLowerCase());
  if (!user) return null;
  if (!verifyPassword(password, user.password)) return null;
  return user;
}

function createSession(userId) {
  const token = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  store.insert('sessions', { token, userId, expiresAt });
  return { token, expiresAt };
}

function userFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE];
  if (!token) return null;
  const session = store.findOne('sessions', (s) => s.token === token);
  if (!session) return null;
  if (new Date(session.expiresAt) < new Date()) {
    store.remove('sessions', (s) => s.token === token);
    return null;
  }
  return store.findOne('users', (u) => u.id === session.userId);
}

function destroySession(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const token = cookies[COOKIE];
  if (token) store.remove('sessions', (s) => s.token === token);
}

function parseCookies(header) {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function sessionCookie(token) {
  return `${COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${SESSION_DAYS * 86400}; SameSite=Lax`;
}

function clearCookie() {
  return `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    language: user.language,
    inviteCode: user.inviteCode || null
  };
}

module.exports = {
  createUser, authenticate, createSession, userFromRequest, destroySession,
  sessionCookie, clearCookie, publicUser, hashPassword, makeInviteCode, COOKIE
};
