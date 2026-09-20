/**
 * api.js — application routes.
 * Every handler returns a plain object; the server serialises it.
 */
const store = require('./store');
const auth = require('./auth');
const medical = require('./medical');
const storycare = require('./storycare');
const safety = require('./safety');
const extract = require('./extract');
const scheduler = require('./scheduler');

function httpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function requireUser(ctx) {
  if (!ctx.user) throw httpError(401, 'Please sign in to continue.');
  return ctx.user;
}

function requireRole(ctx, role) {
  const user = requireUser(ctx);
  if (user.role !== role) throw httpError(403, 'This screen belongs to the other mode of the app.');
  return user;
}

/** The senior whose data a caregiver may read, via an active consent link. */
function linkedSenior(caregiver) {
  const link = store.findOne('links', (l) => l.caregiverId === caregiver.id && l.status === 'active');
  if (!link) return null;
  const senior = store.findOne('users', (u) => u.id === link.seniorId);
  return senior ? { link, senior } : null;
}

function timelineAdd(seniorId, entry) {
  return store.insert('timeline', Object.assign({ seniorId, at: new Date().toISOString() }, entry));
}

const routes = {};
const route = (method, path, handler) => { routes[method + ' ' + path] = handler; };

/* ------------------------------------------------------------------ auth */

route('POST', '/api/auth/signup', async (ctx) => {
  const { name, email, password, role, language } = ctx.body || {};
  if (!name || !email || !password) throw httpError(400, 'Name, email and password are all needed.');
  if (String(password).length < 6) throw httpError(400, 'Use a password of at least 6 characters.');
  const user = auth.createUser({ name, email, password, role, language });
  const session = auth.createSession(user.id);
  ctx.setCookie(auth.sessionCookie(session.token));
  if (user.role === 'senior') seedStarterData(user);
  return { user: auth.publicUser(user) };
});

route('POST', '/api/auth/login', async (ctx) => {
  const { email, password } = ctx.body || {};
  const user = auth.authenticate(email, password);
  if (!user) throw httpError(401, 'That email and password do not match an account.');
  const session = auth.createSession(user.id);
  ctx.setCookie(auth.sessionCookie(session.token));
  return { user: auth.publicUser(user) };
});

route('POST', '/api/auth/logout', async (ctx) => {
  auth.destroySession(ctx.req);
  ctx.setCookie(auth.clearCookie());
  return { ok: true };
});

route('GET', '/api/me', async (ctx) => {
  if (!ctx.user) return { user: null };
  const payload = { user: auth.publicUser(ctx.user) };
  if (ctx.user.role === 'caregiver') {
    const pair = linkedSenior(ctx.user);
    payload.linkedTo = pair ? { id: pair.senior.id, name: pair.senior.name } : null;
  }
  return payload;
});

route('POST', '/api/me/language', async (ctx) => {
  const user = requireUser(ctx);
  const lang = ctx.body && ctx.body.language === 'hi' ? 'hi' : 'en';
  store.update('users', user.id, { language: lang });
  return { language: lang };
});

/* ------------------------------------------------------------- medicines */

route('GET', '/api/senior/home', async (ctx) => {
  const user = requireRole(ctx, 'senior');
  scheduler.tick();
  return seniorHome(user);
});

function seniorHome(user) {
  const day = scheduler.todayKey();
  const doses = store.find('doses', (d) => d.seniorId === user.id && d.day === day)
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
    .map(decorateDose);

  const next = doses.find((d) => d.status !== 'confirmed');
  const alerts = store.find('alerts', (a) => a.seniorId === user.id && a.audience === 'senior' && !a.resolved)
    .slice(-3).reverse();
  const links = store.find('links', (l) => l.seniorId === user.id && l.status !== 'revoked')
    .map((l) => {
      const cg = store.findOne('users', (u) => u.id === l.caregiverId);
      return { id: l.id, status: l.status, caregiverName: cg ? cg.name : 'Family member', since: l.createdAt };
    });
  const reports = store.find('reports', (r) => r.seniorId === user.id)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    user: auth.publicUser(user),
    today: day,
    doses,
    next: next || null,
    alerts,
    links,
    latestReport: reports[0] ? summariseReport(reports[0], user.language) : null,
    reportCount: reports.length,
    adherence: scheduler.adherence(user.id, 14)
  };
}

function decorateDose(d) {
  return Object.assign({}, d, {
    due: scheduler.dueState(d),
    graceMinutes: scheduler.GRACE_MINUTES[d.criticality] || 60,
    timeLabel: scheduler.fmtTime(d.scheduledFor)
  });
}

route('POST', '/api/doses/confirm', async (ctx) => {
  const user = requireRole(ctx, 'senior');
  const { doseId } = ctx.body || {};
  const dose = scheduler.confirmDose(doseId, user.id);
  if (!dose) throw httpError(404, 'That medicine is not on today\u2019s list.');
  return { dose: decorateDose(dose), home: seniorHome(user) };
});

route('GET', '/api/prescriptions', async (ctx) => {
  const user = requireRole(ctx, 'senior');
  return { prescriptions: store.find('prescriptions', (p) => p.seniorId === user.id && !p.stopped) };
});

/** Stage 1: read the prescription. Nothing is saved yet — a human must confirm. */
route('POST', '/api/prescriptions/read', async (ctx) => {
  requireRole(ctx, 'senior');
  const { text, kind } = ctx.body || {};
  if (kind === 'image') {
    const ocr = await extract.runOcr(null, 'upload');
    if (!ocr.ok) return { candidates: [], ocr: false, note: ocr.note };
  }
  const candidates = extract.parsePrescription(text || '');
  return { candidates, ocr: true, note: candidates.length ? null : 'No medicine lines were recognised. You can add the medicine by hand.' };
});

/** Stage 2: the senior confirms, and only then does a reminder exist. */
route('POST', '/api/prescriptions/confirm', async (ctx) => {
  const user = requireRole(ctx, 'senior');
  const items = (ctx.body && ctx.body.items) || [];
  if (!items.length) throw httpError(400, 'Nothing was selected to confirm.');
  const saved = [];
  for (const item of items) {
    if (!item.medicine || !item.dose || !item.time) continue;
    saved.push(store.insert('prescriptions', {
      seniorId: user.id,
      medicine: String(item.medicine).slice(0, 60),
      dose: String(item.dose).slice(0, 30),
      time: /^\d{2}:\d{2}$/.test(item.time) ? item.time : '08:30',
      instruction: String(item.instruction || '').slice(0, 60),
      criticality: item.criticality === 'critical' ? 'critical' : extract.criticalityFor(item.medicine),
      source: 'prescription',
      verifiedBy: user.id,
      verified: true,
      stopped: false
    }));
  }
  scheduler.ensureDoses();
  if (saved.length) {
    timelineAdd(user.id, {
      type: 'prescription',
      title: { en: 'Prescription confirmed', hi: 'नुस्खा पुष्टि हुआ' },
      detail: {
        en: saved.map((s) => `${s.medicine} ${s.dose} at ${s.time}`).join(', '),
        hi: saved.map((s) => `${s.medicine} ${s.dose} — ${s.time}`).join(', ')
      }
    });
  }
  return { saved, prescriptions: store.find('prescriptions', (p) => p.seniorId === user.id && !p.stopped) };
});

route('POST', '/api/prescriptions/stop', async (ctx) => {
  const user = requireRole(ctx, 'senior');
  const { id } = ctx.body || {};
  const p = store.findOne('prescriptions', (x) => x.id === id && x.seniorId === user.id);
  if (!p) throw httpError(404, 'That medicine was not found.');
  store.update('prescriptions', p.id, { stopped: true });
  store.remove('doses', (d) => d.prescriptionId === p.id && d.status === 'pending');
  return { ok: true };
});

/* --------------------------------------------------------------- reports */

route('POST', '/api/reports', async (ctx) => {
  const user = requireRole(ctx, 'senior');
  const { text, title, kind } = ctx.body || {};
  if (kind === 'image') {
    const ocr = await extract.runOcr(null, 'upload');
    if (!ocr.ok) {
      return { ocr: false, note: ocr.note, report: null };
    }
  }
  if (!text || String(text).trim().length < 4) throw httpError(400, 'Add the report text, or type the values you want explained.');

  const { findings, unmatched } = extract.parseReport(text);
  if (!findings.length) {
    return {
      ocr: true,
      report: null,
      note: 'No familiar test values were recognised. Try lines such as "HbA1c: 8.2 %" on separate lines.',
      unmatched
    };
  }

  const report = store.insert('reports', {
    seniorId: user.id,
    title: String(title || 'Lab report').slice(0, 60),
    rawText: String(text).slice(0, 8000),
    findings,
    shared: true,
    reportDate: new Date().toISOString()
  });

  const flagged = findings.filter((f) => f.status !== 'normal');
  timelineAdd(user.id, {
    type: 'report',
    reportId: report.id,
    title: { en: 'Lab report explained', hi: 'लैब रिपोर्ट समझाई गई' },
    detail: {
      en: flagged.length
        ? `${flagged.length} value${flagged.length > 1 ? 's' : ''} outside the usual range: ${flagged.map((f) => `${f.label} ${f.display}`).join(', ')}`
        : 'All recognised values inside the usual range',
      hi: flagged.length
        ? `${flagged.length} मान सामान्य सीमा से बाहर: ${flagged.map((f) => `${f.labelHi} ${f.display}`).join(', ')}`
        : 'सभी पहचाने गए मान सामान्य सीमा में'
    }
  });

  return { ocr: true, report: summariseReport(report, user.language), unmatched };
});

route('GET', '/api/reports', async (ctx) => {
  const user = requireUser(ctx);
  let seniorId = user.id;
  if (user.role === 'caregiver') {
    const pair = linkedSenior(user);
    if (!pair) return { reports: [] };
    seniorId = pair.senior.id;
    const reports = store.find('reports', (r) => r.seniorId === seniorId && r.shared);
    return { reports: reports.sort(byNewest).map((r) => summariseReport(r, user.language)) };
  }
  const reports = store.find('reports', (r) => r.seniorId === seniorId);
  return { reports: reports.sort(byNewest).map((r) => summariseReport(r, user.language)) };
});

route('POST', '/api/reports/share', async (ctx) => {
  const user = requireRole(ctx, 'senior');
  const { id, shared } = ctx.body || {};
  const report = store.findOne('reports', (r) => r.id === id && r.seniorId === user.id);
  if (!report) throw httpError(404, 'That report was not found.');
  store.update('reports', report.id, { shared: !!shared });
  return { id: report.id, shared: !!shared };
});

function byNewest(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); }

/** Turn stored findings into explained, safety-checked, per-language output. */
function summariseReport(report, lang) {
  const L = lang === 'hi' ? 'hi' : 'en';
  const findings = report.findings.map((f) => {
    const analyte = medical.BY_KEY[f.key];
    const ex = medical.explain(analyte, f.value, f.status, L);
    const checked = safety.guard(ex.meaning, L);
    return Object.assign({}, f, {
      label: L === 'hi' ? f.labelHi : f.label,
      what: ex.what,
      meaning: checked.text,
      ask: ex.ask,
      story: f.story
    });
  });

  const flagged = findings.filter((f) => f.status !== 'normal');
  const headline = flagged.length === 0
    ? (L === 'hi' ? 'इस रिपोर्ट के सभी पहचाने गए मान सामान्य सीमा में हैं।' : 'Every value CareMate recognised in this report is inside the usual range.')
    : (L === 'hi'
        ? `${flagged.length} मान सामान्य सीमा से बाहर है${flagged.length > 1 ? 'ं' : ''}। यह अकेले किसी आपात स्थिति का संकेत नहीं है।`
        : `${flagged.length} value${flagged.length > 1 ? 's are' : ' is'} outside the usual range. On its own, that is not a sign of an emergency.`);

  return {
    id: report.id,
    title: report.title,
    createdAt: report.createdAt,
    shared: report.shared,
    headline,
    findings,
    spokenText: spokenSummary(headline, findings, L),
    disclaimer: safety.DISCLAIMER[L]
  };
}

function spokenSummary(headline, findings, L) {
  const parts = [headline];
  for (const f of findings.filter((x) => x.status !== 'normal')) {
    parts.push(`${f.label}: ${f.display} ${f.unit}. ${f.meaning} ${f.ask}`);
  }
  if (parts.length === 1) {
    parts.push(L === 'hi' ? 'अगली मुलाक़ात पर यह रिपोर्ट डॉक्टर को दिखाएँ।' : 'Show this report to your doctor at your next visit.');
  }
  return parts.join(' ');
}

/* ------------------------------------------------------------- storycare */

route('GET', '/api/stories', async (ctx) => {
  const lang = (ctx.query.lang || (ctx.user && ctx.user.language) || 'en');
  return { stories: storycare.listStories(lang) };
});

route('POST', '/api/story', async (ctx) => {
  const user = requireUser(ctx);
  const lang = (ctx.body && ctx.body.lang) || user.language || 'en';
  const askedRaw = (ctx.body && (ctx.body.key || ctx.body.question)) || '';

  const urgent = safety.guard(askedRaw, lang);
  if (urgent.urgent) return { urgent: true, text: urgent.text, disclaimer: urgent.disclaimer };

  const key = storycare.STORIES[askedRaw] ? askedRaw : storycare.matchStory(askedRaw);
  if (!key) {
    return {
      story: null,
      disclaimer: safety.DISCLAIMER[lang === 'hi' ? 'hi' : 'en'],
      note: lang === 'hi'
        ? 'इस शब्द के लिए अभी कोई कहानी तैयार नहीं है। नीचे दिए विषयों में से चुनें या यह शब्द अपने डॉक्टर से पूछें।'
        : 'There is no prepared story for that word yet. Pick one of the topics below, or ask your doctor about it.'
    };
  }
  const story = storycare.getStory(key, lang);
  const spoken = [story.picture, story.mechanism, story.why].join(' ');
  return { story, spokenText: spoken, disclaimer: safety.DISCLAIMER[lang === 'hi' ? 'hi' : 'en'] };
});

/* ------------------------------------------------ consent & family link */

route('GET', '/api/link', async (ctx) => {
  const user = requireUser(ctx);
  if (user.role === 'senior') {
    const links = store.find('links', (l) => l.seniorId === user.id).map((l) => {
      const cg = store.findOne('users', (u) => u.id === l.caregiverId);
      return { id: l.id, status: l.status, caregiverName: cg ? cg.name : 'Family member', caregiverEmail: cg ? cg.email : '', createdAt: l.createdAt, revokedAt: l.revokedAt || null };
    });
    return { role: 'senior', inviteCode: user.inviteCode, links };
  }
  const links = store.find('links', (l) => l.caregiverId === user.id).map((l) => {
    const sr = store.findOne('users', (u) => u.id === l.seniorId);
    return { id: l.id, status: l.status, seniorName: sr ? sr.name : '', createdAt: l.createdAt };
  });
  return { role: 'caregiver', links };
});

/** Caregiver asks; the senior is always the one who grants. */
route('POST', '/api/link/request', async (ctx) => {
  const user = requireRole(ctx, 'caregiver');
  const code = String((ctx.body && ctx.body.code) || '').trim().toUpperCase();
  const senior = store.findOne('users', (u) => u.role === 'senior' && u.inviteCode === code);
  if (!senior) throw httpError(404, 'That care code does not match an account. Ask for it again from the home screen of their app.');
  const existing = store.findOne('links', (l) => l.seniorId === senior.id && l.caregiverId === user.id && l.status !== 'revoked');
  if (existing) return { link: existing, note: 'A request already exists.' };

  const link = store.insert('links', { seniorId: senior.id, caregiverId: user.id, status: 'pending', revokedAt: null });
  scheduler.raiseAlert({
    seniorId: senior.id,
    audience: 'senior',
    kind: 'link_request',
    doseId: null,
    title: { en: 'Someone wants to help', hi: 'कोई मदद करना चाहता है' },
    body: {
      en: `${user.name} has asked to follow your medicine reminders and shared reports. You decide.`,
      hi: `${user.name} ने आपकी दवा और साझा रिपोर्ट देखने की अनुमति माँगी है। फ़ैसला आपका है।`
    },
    severity: 'info'
  });
  return { link };
});

route('POST', '/api/link/approve', async (ctx) => {
  const user = requireRole(ctx, 'senior');
  const link = store.findOne('links', (l) => l.id === (ctx.body || {}).id && l.seniorId === user.id);
  if (!link) throw httpError(404, 'That request was not found.');
  store.update('links', link.id, { status: 'active', approvedAt: new Date().toISOString() });
  const cg = store.findOne('users', (u) => u.id === link.caregiverId);
  timelineAdd(user.id, {
    type: 'consent',
    title: { en: 'Sharing turned on', hi: 'साझा करना चालू' },
    detail: { en: `${cg ? cg.name : 'A family member'} can now see medicine confirmations and shared reports.`, hi: `${cg ? cg.name : 'परिवार के सदस्य'} अब दवा की पुष्टि और साझा रिपोर्ट देख सकते हैं।` }
  });
  for (const a of store.find('alerts', (a) => a.kind === 'link_request' && a.seniorId === user.id && !a.resolved)) {
    store.update('alerts', a.id, { resolved: true });
  }
  return { ok: true };
});

route('POST', '/api/link/revoke', async (ctx) => {
  const user = requireRole(ctx, 'senior');
  const link = store.findOne('links', (l) => l.id === (ctx.body || {}).id && l.seniorId === user.id);
  if (!link) throw httpError(404, 'That link was not found.');
  store.update('links', link.id, { status: 'revoked', revokedAt: new Date().toISOString() });
  const cg = store.findOne('users', (u) => u.id === link.caregiverId);
  timelineAdd(user.id, {
    type: 'consent',
    title: { en: 'Sharing turned off', hi: 'साझा करना बंद' },
    detail: { en: `${cg ? cg.name : 'A family member'} can no longer see your health information.`, hi: `${cg ? cg.name : 'परिवार के सदस्य'} अब आपकी स्वास्थ्य जानकारी नहीं देख सकते।` }
  });
  return { ok: true };
});

/* -------------------------------------------------------------- caregiver */

route('GET', '/api/caregiver/home', async (ctx) => {
  const user = requireRole(ctx, 'caregiver');
  scheduler.tick();
  const pair = linkedSenior(user);
  if (!pair) {
    const pending = store.find('links', (l) => l.caregiverId === user.id && l.status === 'pending');
    return { linked: false, pending: pending.length > 0 };
  }
  const senior = pair.senior;
  const day = scheduler.todayKey();
  const doses = store.find('doses', (d) => d.seniorId === senior.id && d.day === day)
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
    .map(decorateDose);

  const alerts = store.find('alerts', (a) => a.caregiverId === user.id && a.audience === 'caregiver')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 25)
    .map((a) => ({
      id: a.id, kind: a.kind, severity: a.severity, read: a.read, createdAt: a.createdAt,
      title: pick(a.title, user.language), body: pick(a.body, user.language), doseId: a.doseId || null
    }));

  const reports = store.find('reports', (r) => r.seniorId === senior.id && r.shared)
    .sort(byNewest).map((r) => summariseReport(r, user.language));

  const timeline = store.find('timeline', (t) => t.seniorId === senior.id)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .map((t) => ({ id: t.id, type: t.type, at: t.at, title: pick(t.title, user.language), detail: pick(t.detail, user.language) }));

  return {
    linked: true,
    senior: { id: senior.id, name: senior.name, language: senior.language },
    linkSince: pair.link.approvedAt || pair.link.createdAt,
    day,
    doses,
    alerts,
    reports,
    timeline,
    adherence14: scheduler.adherence(senior.id, 14),
    adherence7: scheduler.adherence(senior.id, 7),
    prescriptions: store.find('prescriptions', (p) => p.seniorId === senior.id && !p.stopped),
    history: adherenceHistory(senior.id, 7)
  };
});

function adherenceHistory(seniorId, days) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = scheduler.todayKey(d);
    const doses = store.find('doses', (x) => x.seniorId === seniorId && x.day === key && new Date(x.scheduledFor) <= new Date());
    const confirmed = doses.filter((x) => x.status === 'confirmed').length;
    out.push({ day: key, total: doses.length, confirmed, percent: doses.length ? Math.round(confirmed / doses.length * 100) : null });
  }
  return out;
}

function pick(value, lang) {
  if (value && typeof value === 'object') return value[lang === 'hi' ? 'hi' : 'en'] || value.en;
  return value;
}

/* ----------------------------------------------------------- notifications */

route('GET', '/api/alerts', async (ctx) => {
  const user = requireUser(ctx);
  scheduler.tick();
  const audience = user.role === 'senior' ? 'senior' : 'caregiver';
  let rows = store.find('alerts', (a) => a.audience === audience &&
    (audience === 'senior' ? a.seniorId === user.id : a.caregiverId === user.id));
  if (ctx.query.unreadOnly === '1') rows = rows.filter((a) => !a.read);
  rows = rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 30);
  return {
    alerts: rows.map((a) => ({
      id: a.id, kind: a.kind, severity: a.severity, read: a.read, resolved: a.resolved, createdAt: a.createdAt,
      title: pick(a.title, user.language), body: pick(a.body, user.language), doseId: a.doseId || null
    }))
  };
});

route('POST', '/api/alerts/read', async (ctx) => {
  const user = requireUser(ctx);
  const ids = (ctx.body && ctx.body.ids) || [];
  for (const id of ids) {
    const a = store.findOne('alerts', (x) => x.id === id);
    if (!a) continue;
    if (a.audience === 'senior' && a.seniorId !== user.id) continue;
    if (a.audience === 'caregiver' && a.caregiverId !== user.id) continue;
    store.update('alerts', id, { read: true });
  }
  return { ok: true };
});

/* -------------------------------------------------------------- timeline */

route('GET', '/api/timeline', async (ctx) => {
  const user = requireUser(ctx);
  const seniorId = user.role === 'senior' ? user.id : (linkedSenior(user) || {}).senior?.id;
  if (!seniorId) return { timeline: [] };
  const rows = store.find('timeline', (t) => t.seniorId === seniorId)
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .map((t) => ({ id: t.id, type: t.type, at: t.at, title: pick(t.title, user.language), detail: pick(t.detail, user.language) }));
  return { timeline: rows };
});

/* ------------------------------------------------------------ ask a word */

route('POST', '/api/ask', async (ctx) => {
  const user = requireUser(ctx);
  const lang = (ctx.body && ctx.body.lang) || user.language || 'en';
  const question = String((ctx.body && ctx.body.question) || '');
  const checked = safety.guard(question, lang);
  if (checked.urgent) return { urgent: true, answer: checked.text, disclaimer: checked.disclaimer };
  if (checked.blocked) return { blocked: true, answer: checked.text, disclaimer: checked.disclaimer };

  const key = storycare.matchStory(question);
  if (key) {
    const story = storycare.getStory(key, lang);
    return {
      answer: [story.picture, story.mechanism, story.why].join(' '),
      story,
      disclaimer: checked.disclaimer
    };
  }
  const analyte = medical.findAnalyte(question);
  if (analyte) {
    const L = lang === 'hi' ? 'hi' : 'en';
    return { answer: `${analyte.what[L]} ${analyte.ask[L]}`, disclaimer: checked.disclaimer };
  }
  return {
    answer: lang === 'hi'
      ? 'यह शब्द अभी केयरमेट की सूची में नहीं है। इसे लिखकर अपने डॉक्टर से पूछें — यही सबसे भरोसेमंद जवाब है।'
      : 'That word is not in CareMate\u2019s list yet. Write it down and ask your doctor, which is the most reliable answer.',
    disclaimer: checked.disclaimer
  };
});

/* ------------------------------------------------------------ demo setup */

/** A new senior account starts with one prescription so the demo has a pulse. */
function seedStarterData(user) {
  const samples = [
    { medicine: 'Amlodipine', dose: '5 mg', time: '08:30', instruction: 'after breakfast', criticality: 'critical' },
    { medicine: 'Atorvastatin', dose: '10 mg', time: '21:00', instruction: 'after dinner', criticality: 'routine' }
  ];
  for (const s of samples) {
    store.insert('prescriptions', Object.assign({ seniorId: user.id, source: 'prescription', verified: true, verifiedBy: user.id, stopped: false }, s));
  }
  scheduler.ensureDoses();
  timelineAdd(user.id, {
    type: 'account',
    title: { en: 'CareMate set up', hi: 'केयरमेट शुरू' },
    detail: { en: 'Medicines from your prescription were confirmed and reminders were turned on.', hi: 'नुस्खे की दवाइयाँ पुष्टि हुईं और याद दिलाना चालू हुआ।' }
  });
}

async function handle(ctx) {
  const handler = routes[ctx.method + ' ' + ctx.path];
  if (!handler) throw httpError(404, 'Unknown endpoint: ' + ctx.path);
  return handler(ctx);
}

module.exports = { handle, routes, seedStarterData, summariseReport, linkedSenior, timelineAdd };
