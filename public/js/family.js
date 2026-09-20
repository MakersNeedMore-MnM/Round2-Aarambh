/* family.js — the caregiver console.
   The hierarchy on this screen is fixed: anything needing a decision is at
   the top, everything else is reference. "Not confirmed" is never rendered
   as "missed" anywhere in this file. */

let state = { user: null, lang: 'en', data: null };
const el = (id) => document.getElementById(id);

const COPY = {
  en: {
    linkedSince: 'sharing active since',
    todayTitle: 'Today',
    needsAttention: 'Needs a look',
    allConfirmed: 'Nothing waiting',
    confirmedToday: 'Confirmed today',
    adherence: 'Confirmed over 14 days',
    ofScheduled: 'of scheduled doses',
    schedule: 'Today’s medicines',
    alerts: 'Activity',
    week: 'Last 7 days',
    reports: 'Shared reports',
    timeline: 'Health timeline',
    medicines: 'Confirmed prescription',
    noAlerts: 'Nothing has happened yet today.',
    noReports: 'No reports have been shared yet.',
    confirmed: 'Confirmed',
    awaiting: 'Not confirmed',
    scheduled: 'Scheduled',
    critical: 'time-critical',
    notMissed: 'Not confirmed means CareMate has not heard from them yet. It does not mean the dose was missed.',
    at: 'at',
    seeValues: 'See what each value means',
    note: 'You see what is shared with you, and only while sharing is allowed. Sharing can be stopped from their screen at any time, and this view will empty immediately. CareMate explains health information; it does not diagnose or prescribe.',
    connectTitle: 'Enter their care code',
    connectBody: 'Ask the person you are helping to read out the six-character code on their Family screen. They will then be asked to allow it — you cannot see anything until they do.',
    connectBtn: 'Send the request',
    pendingTitle: 'Waiting for their decision',
    pendingBody: 'The request has been sent. Nothing is shared until they allow it on their own screen.',
    signOut: 'Sign out',
    alertsOn: 'Alerts on',
    alertsOff: 'Turn on alerts'
  },
  hi: {
    linkedSince: 'साझा चालू है',
    todayTitle: 'आज',
    needsAttention: 'ध्यान चाहिए',
    allConfirmed: 'कुछ बाकी नहीं',
    confirmedToday: 'आज पुष्टि हुई',
    adherence: '14 दिनों में पुष्टि',
    ofScheduled: 'निर्धारित खुराकों में से',
    schedule: 'आज की दवाइयाँ',
    alerts: 'गतिविधि',
    week: 'पिछले 7 दिन',
    reports: 'साझा रिपोर्ट',
    timeline: 'स्वास्थ्य समयरेखा',
    medicines: 'पुष्ट नुस्खा',
    noAlerts: 'आज अभी तक कुछ नहीं हुआ।',
    noReports: 'अभी कोई रिपोर्ट साझा नहीं हुई।',
    confirmed: 'पुष्टि हुई',
    awaiting: 'पुष्टि नहीं',
    scheduled: 'निर्धारित',
    critical: 'समय-संवेदनशील',
    notMissed: '"पुष्टि नहीं" का मतलब है कि केयरमेट को अभी जवाब नहीं मिला। इसका मतलब खुराक छूटना नहीं है।',
    at: 'समय',
    seeValues: 'हर मान का मतलब देखें',
    note: 'आपको वही दिखता है जो साझा किया गया है, और तभी तक जब तक अनुमति है। अनुमति कभी भी उनकी स्क्रीन से बंद की जा सकती है और यह पेज तुरंत खाली हो जाएगा। केयरमेट जानकारी समझाता है; रोग नहीं बताता।',
    connectTitle: 'उनका केयर कोड डालें',
    connectBody: 'जिनकी मदद कर रहे हैं उनसे उनकी "परिवार" स्क्रीन का छह अक्षरों का कोड पूछें। फिर अनुमति उन्हीं से माँगी जाएगी — अनुमति मिलने तक आपको कुछ नहीं दिखेगा।',
    connectBtn: 'अनुरोध भेजें',
    pendingTitle: 'उनके फ़ैसले का इंतज़ार',
    pendingBody: 'अनुरोध भेज दिया गया है। जब तक वे अनुमति नहीं देते, कुछ भी साझा नहीं होता।',
    signOut: 'बाहर निकलें',
    alertsOn: 'सूचनाएँ चालू',
    alertsOff: 'सूचनाएँ चालू करें'
  }
};
const c = (k) => (COPY[state.lang] || COPY.en)[k] || k;

boot();

async function boot() {
  const me = await api.get('/api/me').catch(() => ({ user: null }));
  if (!me.user) { location.href = '/'; return; }
  if (me.user.role !== 'caregiver') { location.href = '/senior'; return; }
  state.user = me.user;
  state.lang = me.user.language === 'hi' ? 'hi' : 'en';

  el('signOut').addEventListener('click', async () => { await api.post('/api/auth/logout', {}); location.href = '/'; });
  el('langBtn').addEventListener('click', async () => {
    state.lang = state.lang === 'hi' ? 'en' : 'hi';
    await api.post('/api/me/language', { language: state.lang }).catch(() => {});
    render();
  });
  el('notifyBtn').addEventListener('click', async () => {
    const ok = await notifier.request();
    el('notifyBtn').dataset.on = String(ok);
    el('notifyBtn').textContent = ok ? c('alertsOn') : c('alertsOff');
  });

  await load();
  const first = await api.get('/api/alerts').catch(() => ({ alerts: [] }));
  notifier.prime(first.alerts || []);

  setInterval(async () => { await load(); pushNew(); }, 20000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
}

async function load() {
  try { state.data = await api.get('/api/caregiver/home'); } catch { return; }
  render();
}

function pushNew() {
  if (!state.data || !state.data.alerts) return;
  for (const a of state.data.alerts.filter((x) => !x.read && x.severity !== 'info')) notifier.show(a);
}

function render() {
  document.documentElement.lang = state.lang;
  el('langBtn').textContent = state.lang === 'hi' ? 'English' : 'हिन्दी';
  el('signOut').textContent = c('signOut');
  el('notifyBtn').textContent = el('notifyBtn').dataset.on === 'true' ? c('alertsOn') : c('alertsOff');
  el('pagenote').textContent = c('note');

  const d = state.data;
  if (!d) return;
  if (!d.linked) { renderConnect(d.pending); return; }

  el('whoName').textContent = d.senior.name;
  el('whoMeta').innerHTML = `<span class="dot"></span>${escapeHtml(c('linkedSince'))} ${escapeHtml(fmtDate(d.linkSince, state.lang))}`;

  const waiting = d.doses.filter((x) => x.status === 'awaiting_confirmation');
  const confirmed = d.doses.filter((x) => x.status === 'confirmed');
  const pct = d.adherence14.percent;

  el('main').innerHTML = `
    <section class="status">
      <div class="stat ${waiting.length ? 'attention' : 'calm'}">
        <h2>${escapeHtml(c('todayTitle'))}</h2>
        ${waiting.length
          ? `<div class="big">${waiting.length} ${escapeHtml(c('needsAttention'))}</div>
             <div class="sub">${escapeHtml(waiting.map((w) => `${w.medicine} ${w.dose} · ${w.timeLabel}`).join(' · '))}</div>
             <div class="sub" style="margin-top:.5rem">${escapeHtml(c('notMissed'))}</div>`
          : `<div class="big">${escapeHtml(c('allConfirmed'))}</div>
             <div class="sub">${confirmed.length} / ${d.doses.length} ${escapeHtml(c('confirmedToday'))}</div>`}
      </div>

      <div class="stat">
        <h2>${escapeHtml(c('confirmedToday'))}</h2>
        <div class="big">${confirmed.length}<span style="color:var(--dimmer);font-size:1.1rem"> / ${d.doses.length}</span></div>
        <div class="sub">${escapeHtml(c('ofScheduled'))}</div>
      </div>

      <div class="stat">
        <h2>${escapeHtml(c('adherence'))}</h2>
        <div class="ring">
          ${ringSvg(pct)}
          <div>
            <div class="ring__num">${pct == null ? '—' : pct + '%'}</div>
            <div class="sub">${d.adherence14.confirmed} / ${d.adherence14.total}</div>
          </div>
        </div>
      </div>
    </section>

    <div class="grid">
      <div>
        <section class="panel">
          <header><h2>${escapeHtml(c('schedule'))}</h2><span class="meta">${escapeHtml(fmtDate(new Date().toISOString(), state.lang))}</span></header>
          <div class="body">${d.doses.length ? d.doses.map(doseRow).join('') : `<p class="empty">${escapeHtml(c('noAlerts'))}</p>`}</div>
        </section>

        <section class="panel">
          <header><h2>${escapeHtml(c('reports'))}</h2><span class="meta">${d.reports.length}</span></header>
          <div class="body">${d.reports.length ? d.reports.map(reportCard).join('') : `<p class="empty">${escapeHtml(c('noReports'))}</p>`}</div>
        </section>

        <section class="panel">
          <header><h2>${escapeHtml(c('medicines'))}</h2></header>
          <div class="body">${d.prescriptions.map(medRow).join('')}</div>
        </section>
      </div>

      <div>
        <section class="panel">
          <header><h2>${escapeHtml(c('alerts'))}</h2></header>
          <div class="body">${d.alerts.length ? d.alerts.slice(0, 10).map(alertRow).join('') : `<p class="empty">${escapeHtml(c('noAlerts'))}</p>`}</div>
        </section>

        <section class="panel">
          <header><h2>${escapeHtml(c('week'))}</h2></header>
          <div class="body">${barsHtml(d.history)}</div>
        </section>

        <section class="panel">
          <header><h2>${escapeHtml(c('timeline'))}</h2></header>
          <div class="body"><div class="rail">${d.timeline.map(nodeHtml).join('')}</div></div>
        </section>
      </div>
    </div>`;

  const unread = d.alerts.filter((a) => !a.read).map((a) => a.id);
  if (unread.length) api.post('/api/alerts/read', { ids: unread }).catch(() => {});
}

function doseRow(x) {
  const chip = x.status === 'confirmed'
    ? `<span class="chip chip--ok">${escapeHtml(c('confirmed'))} ${escapeHtml(fmtClock(x.confirmedAt))}</span>`
    : x.status === 'awaiting_confirmation'
      ? `<span class="chip chip--wait">${escapeHtml(c('awaiting'))}</span>`
      : `<span class="chip chip--idle">${escapeHtml(c('scheduled'))}</span>`;
  return `
    <div class="dose">
      <div class="dose__time">${escapeHtml(x.timeLabel)}</div>
      <div>
        <div class="dose__name">${escapeHtml(x.medicine)} ${escapeHtml(x.dose)}</div>
        <div class="dose__meta">${escapeHtml(x.instruction || '')}${x.criticality === 'critical' ? ` · ${escapeHtml(c('critical'))}, ${x.graceMinutes} min` : ''}</div>
      </div>
      ${chip}
    </div>`;
}

function medRow(p) {
  return `
    <div class="dose">
      <div class="dose__time">${escapeHtml(p.time)}</div>
      <div>
        <div class="dose__name">${escapeHtml(p.medicine)} ${escapeHtml(p.dose)}</div>
        <div class="dose__meta">${escapeHtml(p.instruction || '')}${p.prescriber ? ' · ' + escapeHtml(p.prescriber) : ''}</div>
      </div>
      ${p.criticality === 'critical' ? `<span class="chip chip--crit">${escapeHtml(c('critical'))}</span>` : ''}
    </div>`;
}

function alertRow(a) {
  const level = a.severity === 'high' ? 'high' : a.severity === 'info' ? 'info' : 'normal';
  return `
    <div class="alert alert--${level}">
      <span class="alert__mark"></span>
      <div style="flex:1">
        <div style="display:flex;gap:.6rem"><h3>${escapeHtml(a.title)}</h3><time>${escapeHtml(timeAgo(a.createdAt, state.lang))}</time></div>
        <p>${escapeHtml(a.body)}</p>
      </div>
    </div>`;
}

function reportCard(r) {
  return `
    <div class="report">
      <h3>${escapeHtml(r.title)}</h3>
      <div class="when">${escapeHtml(fmtDate(r.createdAt, state.lang))}</div>
      <p class="head">${escapeHtml(r.headline)}</p>
      <div class="values">${r.findings.map((f) =>
        `<span class="value ${f.status !== 'normal' ? 'out' : ''}">${escapeHtml(f.label)} ${escapeHtml(f.display)}</span>`).join('')}</div>
      <details>
        <summary>${escapeHtml(c('seeValues'))}</summary>
        <dl>${r.findings.map((f) => `<dt>${escapeHtml(f.label)}</dt><dd>${escapeHtml(f.meaning)}</dd>`).join('')}</dl>
      </details>
    </div>`;
}

function barsHtml(history) {
  const bars = history.map((h) => {
    const pct = h.percent == null ? 0 : h.percent;
    return `<div title="${escapeHtml(h.day)}: ${h.confirmed}/${h.total}"><span style="height:${pct}%"></span></div>`;
  }).join('');
  const labels = history.map((h) =>
    `<span>${new Date(h.day).toLocaleDateString(state.lang === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'narrow' })}</span>`).join('');
  return `<div class="bars">${bars}</div><div class="bars-x">${labels}</div>`;
}

function nodeHtml(n) {
  const upcoming = new Date(n.at) > new Date();
  return `
    <div class="node ${upcoming ? 'node--upcoming' : ''}">
      <time>${escapeHtml(fmtDate(n.at, state.lang))}</time>
      <h3>${escapeHtml(n.title)}</h3>
      <p>${escapeHtml(n.detail || '')}</p>
    </div>`;
}

function ringSvg(percent) {
  const p = percent == null ? 0 : percent;
  const r = 26, circ = 2 * Math.PI * r;
  const filled = (p / 100) * circ;
  return `
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="${r}" fill="none" stroke="#26313F" stroke-width="7"/>
      <circle cx="32" cy="32" r="${r}" fill="none" stroke="${p >= 85 ? '#5FD3B2' : p >= 60 ? '#F2B441' : '#F08A7C'}"
        stroke-width="7" stroke-linecap="round" stroke-dasharray="${filled} ${circ}" transform="rotate(-90 32 32)"/>
    </svg>`;
}

/* ------------------------------------------------------------ unlinked */

function renderConnect(pending) {
  el('whoName').textContent = 'CareMate';
  el('whoMeta').textContent = '';
  if (pending) {
    el('main').innerHTML = `
      <div class="connect">
        <h1>${escapeHtml(c('pendingTitle'))}</h1>
        <p>${escapeHtml(c('pendingBody'))}</p>
      </div>`;
    return;
  }
  el('main').innerHTML = `
    <div class="connect">
      <h1>${escapeHtml(c('connectTitle'))}</h1>
      <p>${escapeHtml(c('connectBody'))}</p>
      <div class="field"><input id="code" maxlength="6" placeholder="ABC123" aria-label="Care code"></div>
      <button class="btn-primary" id="connectBtn">${escapeHtml(c('connectBtn'))}</button>
      <p class="notice" id="connectNotice" role="alert"></p>
      <p class="note">Demo: sign in as the elder account in another browser window to read the code and allow the request.</p>
    </div>`;
  el('connectBtn').addEventListener('click', async () => {
    const code = el('code').value.trim().toUpperCase();
    try {
      await api.post('/api/link/request', { code });
      load();
    } catch (err) { el('connectNotice').textContent = err.message; }
  });
}
