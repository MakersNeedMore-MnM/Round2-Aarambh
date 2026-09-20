/* client.js — shared browser helpers: API calls, speech, notifications. */

const api = {
  async get(path) { return this.send('GET', path); },
  async post(path, body) { return this.send('POST', path, body); },
  async send(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401) { location.href = '/'; throw new Error('Signed out'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  }
};

/* --------------------------------------------------------------- speech */
/* Browser speech synthesis. Hindi output prefers a hi-IN voice and falls
   back to an Indian English voice, which still reads Devanagari acceptably
   on most systems. The button is always a toggle: a speaking app that cannot
   be stopped is worse than one that never speaks. */

const speech = {
  current: null,
  onState: null,

  voices() { return window.speechSynthesis ? window.speechSynthesis.getVoices() : []; },

  pickVoice(lang) {
    const list = this.voices();
    if (!list.length) return null;
    const want = lang === 'hi' ? 'hi' : 'en';
    return list.find((v) => v.lang && v.lang.toLowerCase().startsWith(want === 'hi' ? 'hi' : 'en-in'))
        || list.find((v) => v.lang && v.lang.toLowerCase().startsWith(want))
        || list.find((v) => v.lang && v.lang.toLowerCase().startsWith('en'))
        || null;
  },

  supported() { return 'speechSynthesis' in window; },

  speak(text, lang, onEnd) {
    if (!this.supported() || !text) { if (onEnd) onEnd(); return false; }
    this.stop();
    // Long text is split on sentence ends; some browsers truncate a single
    // very long utterance.
    const chunks = String(text).match(/[^.!?।]+[.!?।]*/g) || [String(text)];
    const queue = chunks.map((c) => c.trim()).filter(Boolean);
    const voice = this.pickVoice(lang);
    let index = 0;

    const next = () => {
      if (index >= queue.length) { this.current = null; this.notify(false); if (onEnd) onEnd(); return; }
      const u = new SpeechSynthesisUtterance(queue[index++]);
      u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
      if (voice) u.voice = voice;
      u.rate = lang === 'hi' ? 0.88 : 0.92;   // unhurried, for an older listener
      u.pitch = 1;
      u.onend = next;
      u.onerror = () => { this.current = null; this.notify(false); if (onEnd) onEnd(); };
      this.current = u;
      window.speechSynthesis.speak(u);
    };
    this.notify(true);
    next();
    return true;
  },

  stop() {
    if (!this.supported()) return;
    window.speechSynthesis.cancel();
    this.current = null;
    this.notify(false);
  },

  speaking() { return this.supported() && window.speechSynthesis.speaking; },
  notify(state) { if (this.onState) this.onState(state); }
};

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => speech.voices();
}

/* -------------------------------------------------------- notifications */

const notifier = {
  seen: new Set(),
  enabled: false,

  async request() {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') { this.enabled = true; return true; }
    if (Notification.permission === 'denied') return false;
    const result = await Notification.requestPermission();
    this.enabled = result === 'granted';
    return this.enabled;
  },

  show(alert) {
    if (this.seen.has(alert.id)) return;
    this.seen.add(alert.id);
    if (!this.enabled || document.visibilityState === 'visible') return;
    try {
      new Notification(alert.title, {
        body: alert.body,
        tag: alert.id,
        requireInteraction: alert.severity === 'high'
      });
    } catch { /* notifications are a courtesy, never a dependency */ }
  },

  /** Mark already-delivered alerts as seen so a page load is not a burst. */
  prime(alerts) { for (const a of alerts) this.seen.add(a.id); }
};

function timeAgo(iso, lang) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 1) return lang === 'hi' ? 'अभी' : 'just now';
  if (mins < 60) return lang === 'hi' ? `${mins} मिनट पहले` : `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return lang === 'hi' ? `${hrs} घंटे पहले` : `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return lang === 'hi' ? `${days} दिन पहले` : `${days} d ago`;
}

function fmtClock(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

function fmtDate(iso, lang) {
  return new Date(iso).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
