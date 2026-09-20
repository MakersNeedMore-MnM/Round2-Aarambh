/* senior.js — the elder's screen.
   Principles kept in the code, not just in the CSS:
     · one network failure never blanks the screen
     · "not confirmed" is always shown with the sentence that explains it
     · the Listen button is a toggle and always reflects real speech state */

let state = { user: null, lang: 'en', home: null, stories: [], tab: 'home', story: null, report: null, rx: [] };
const t = (key) => (window.I18N[state.lang] || window.I18N.en)[key] || key;
const el = (id) => document.getElementById(id);

boot();

async function boot() {
  const me = await api.get('/api/me').catch(() => ({ user: null }));
  if (!me.user) { location.href = '/'; return; }
  if (me.user.role !== 'senior') { location.href = '/family'; return; }
  state.user = me.user;
  state.lang = me.user.language === 'hi' ? 'hi' : 'en';

  wireTabs();
  wireControls();
  applyLanguage();
  await Promise.all([refresh(), loadStories()]);

  notifier.request();
  const first = await api.get('/api/alerts').catch(() => ({ alerts: [] }));
  notifier.prime(first.alerts || []);

  setInterval(pollAlerts, 20000);
  setInterval(refresh, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

  speech.onState = (speaking) => {
    document.querySelectorAll('.btn-listen').forEach((b) => {
      b.dataset.speaking = String(speaking);
      b.querySelector('.label').textContent = speaking ? t('stop') : t('listen');
    });
  };
}

/* ------------------------------------------------------------- chrome */

function wireTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      speech.stop();
      document.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      ['home', 'report', 'story', 'family'].forEach((name) => {
        el('panel-' + name).hidden = name !== state.tab;
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function wireControls() {
  el('signOut').addEventListener('click', async () => {
    await api.post('/api/auth/logout', {});
    location.href = '/';
  });

  el('langBtn').addEventListener('click', async () => {
    const next = state.lang === 'hi' ? 'en' : 'hi';
    await api.post('/api/me/language', { language: next }).catch(() => {});
    state.lang = next;
    speech.stop();
    applyLanguage();
    await Promise.all([refresh(), loadStories()]);
    if (state.story) showStory(state.story.key);
  });

  el('explainBtn').addEventListener('click', explainReport);
  el('sampleBtn').addEventListener('click', () => {
    el('reportText').value = [
      'HbA1c: 8.2 %',
      'Fasting glucose: 142 mg/dL',
      'eGFR: 64 mL/min',
      'LDL cholesterol: 138 mg/dL',
      'Haemoglobin: 13.4 g/dL',
      'Vitamin D: 18 ng/mL'
    ].join('\n');
    el('reportNote').textContent = '';
  });
  el('fileBtn').addEventListener('click', () => el('fileInput').click());
  el('fileInput').addEventListener('change', handleFile);
  el('askBtn').addEventListener('click', () => askWord());
  el('askInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') askWord(); });

  el('rxReadBtn').addEventListener('click', readPrescription);
  el('rxSampleBtn').addEventListener('click', () => {
    el('rxText').value = [
      'Dr. A. Menon, General Medicine',
      'Tab. Telmisartan 40 mg - 1-0-0 after breakfast',
      'Tab. Metformin 500 mg twice daily after food',
      'Tab. Atorvastatin 10 mg at night'
    ].join('\n');
    el('rxNote').textContent = '';
  });
}

/* ------------------------------------ prescription -> verified reminder */

async function readPrescription() {
  el('rxNote').textContent = '';
  el('rxCandidates').innerHTML = '';
  const text = el('rxText').value.trim();
  if (!text) { el('rxNote').textContent = t('rxIntro'); return; }
  const res = await api.post('/api/prescriptions/read', { text }).catch((e) => ({ candidates: [], note: e.message }));
  state.rx = res.candidates || [];
  if (!state.rx.length) { el('rxNote').textContent = res.note || t('rxNone'); return; }
  renderCandidates();
}

function renderCandidates() {
  if (!state.rx.length) { el('rxCandidates').innerHTML = ''; return; }
  el('rxCandidates').innerHTML = `
    <p class="headline" style="margin-top:1.4rem">${escapeHtml(t('rxFound'))}</p>
    ${state.rx.map((cand, i) => `
      <div class="finding finding--in">
        <div class="finding__head">
          <span class="finding__name">${escapeHtml(cand.medicine)}</span>
          <span class="finding__value">${escapeHtml(cand.dose)}</span>
        </div>
        <div class="finding__range">${escapeHtml(cand.instruction || '')}</div>
        <label style="display:block;font-size:1rem;font-weight:700;color:var(--ink-soft);margin-bottom:.3rem">${escapeHtml(t('rxTime'))}</label>
        <input type="time" class="big" data-time="${i}" value="${escapeHtml(cand.time)}" style="min-height:60px;max-width:12rem">
        <p style="font-size:1rem;color:var(--ink-soft);margin:.9rem 0 0">
          ${escapeHtml(cand.criticality === 'critical' ? t('rxCritical') : t('rxRoutine'))}
        </p>
        <button class="btn-ghost" data-drop="${i}" style="min-height:56px;margin-top:.8rem">${escapeHtml(t('rxDrop'))}</button>
      </div>`).join('')}
    <button class="btn-main" id="rxConfirmBtn" style="width:100%">${escapeHtml(t('rxConfirm'))}</button>`;

  el('rxCandidates').querySelectorAll('[data-time]').forEach((input) => {
    input.addEventListener('change', () => { state.rx[Number(input.dataset.time)].time = input.value; });
  });
  el('rxCandidates').querySelectorAll('[data-drop]').forEach((btn) => {
    btn.addEventListener('click', () => { state.rx.splice(Number(btn.dataset.drop), 1); renderCandidates(); });
  });
  el('rxConfirmBtn').addEventListener('click', async () => {
    try {
      await api.post('/api/prescriptions/confirm', { items: state.rx });
      state.rx = [];
      el('rxCandidates').innerHTML = '';
      el('rxText').value = '';
      toast(t('rxSaved'));
      refresh();
    } catch (err) { el('rxNote').textContent = err.message; }
  });
}

function applyLanguage() {
  document.documentElement.lang = state.lang;
  const hour = new Date().getHours();
  el('greeting').textContent = `${hour < 12 ? t('greetMorning') : hour < 17 ? t('greetAfternoon') : t('greetEvening')}, ${state.user.name.split(' ')[0]}`;
  el('todayLabel').textContent = new Date().toLocaleDateString(t('locale'), { weekday: 'long', day: 'numeric', month: 'long' });
  el('langBtn').textContent = t('language');
  el('signOut').textContent = t('signOut');
  el('disclaimer').textContent = t('disclaimer');
  el('reportIntro').textContent = t('reportIntro');
  el('storyIntro').textContent = t('storyIntro');
  el('reportText').placeholder = t('reportPlaceholder');
  el('askInput').placeholder = t('askPlaceholder');
  el('rxTitle').textContent = t('rxTitle');
  el('rxIntro').textContent = t('rxIntro');
  el('rxText').placeholder = t('rxPlaceholder');
  el('rxReadBtn').textContent = t('rxRead');
  el('rxSampleBtn').textContent = t('rxSample');
  renderCandidates();
  document.querySelectorAll('[data-t]').forEach((n) => { n.textContent = t(n.dataset.t); });
}

/* --------------------------------------------------------------- today */

async function refresh() {
  try {
    state.home = await api.get('/api/senior/home');
  } catch { return; }
  renderNext();
  renderMedList();
  renderFamily();
  if (state.report) renderReport(state.report);
}

function renderNext() {
  const card = el('nextCard');
  const next = state.home.next;

  if (!next) {
    const anyToday = state.home.doses.length > 0;
    card.className = 'card-lg next is-done';
    card.innerHTML = `
      <div class="done-line"><span aria-hidden="true">✓</span><span>${escapeHtml(anyToday ? t('allDone') : t('noMedicineToday'))}</span></div>`;
    return;
  }

  const waiting = next.status === 'awaiting_confirmation';
  card.className = 'card-lg next' + (waiting ? ' is-waiting' : '');
  card.innerHTML = `
    <div class="next__time">${escapeHtml(waiting ? t('waiting') : t('nextMedicine') + ' · ' + next.timeLabel)}</div>
    <div class="next__med">${escapeHtml(next.medicine)}</div>
    <p class="next__dose">${escapeHtml(next.dose)}${next.instruction ? ' · ' + escapeHtml(next.instruction) : ''} · ${escapeHtml(next.timeLabel)}</p>
    ${waiting ? `<p class="next__note">${escapeHtml(t('notMissed'))}</p>` : ''}
    <button class="btn-listen" id="listenNext" data-speaking="false">
      <span aria-hidden="true">🔊</span><span class="label">${escapeHtml(t('listen'))}</span>
    </button>
    <button class="btn-take" id="takeBtn"><span aria-hidden="true">✓</span>${escapeHtml(t('takeIt'))}</button>`;

  el('takeBtn').addEventListener('click', () => confirmDose(next.id));
  el('listenNext').addEventListener('click', () => {
    if (speech.speaking()) return speech.stop();
    const line = state.lang === 'hi'
      ? `${t('nextMedicine')}: ${next.medicine}, ${next.dose}, ${next.timeLabel}${next.instruction ? ', ' + next.instruction : ''}. दवा लेने के बाद हरा बटन दबाएँ।`
      : `${t('nextMedicine')}: ${next.medicine}, ${next.dose}, at ${next.timeLabel}${next.instruction ? ', ' + next.instruction : ''}. After taking it, press the green button.`;
    speech.speak(line, state.lang);
  });
}

function renderMedList() {
  const list = state.home.doses;
  if (!list.length) {
    el('medList').innerHTML = `<p style="margin:0;color:var(--ink-soft)">${escapeHtml(t('noMedicineToday'))}</p>`;
    return;
  }
  el('medList').innerHTML = list.map((d) => {
    const confirmed = d.status === 'confirmed';
    const waiting = d.status === 'awaiting_confirmation';
    const stateLabel = confirmed
      ? `${t('confirmedAt')} ${fmtClock(d.confirmedAt)}`
      : waiting ? t('notConfirmed') : t('upcoming');
    const cls = confirmed ? 'state--confirmed' : waiting ? 'state--waiting' : 'state--pending';
    return `
      <div class="med">
        <div class="med__time">${escapeHtml(d.timeLabel)}</div>
        <div class="med__body">
          <div class="med__name">${escapeHtml(d.medicine)} ${escapeHtml(d.dose)}</div>
          <div class="med__sub">${escapeHtml(d.instruction || '')}</div>
          <div style="margin-top:.5rem"><span class="state ${cls}">${escapeHtml(stateLabel)}</span></div>
        </div>
        ${confirmed ? '' : `<button class="btn-small" data-confirm="${d.id}">${escapeHtml(t('takeIt'))}</button>`}
      </div>`;
  }).join('');

  el('medList').querySelectorAll('[data-confirm]').forEach((btn) => {
    btn.addEventListener('click', () => confirmDose(btn.dataset.confirm));
  });
}

async function confirmDose(doseId) {
  try {
    const res = await api.post('/api/doses/confirm', { doseId });
    state.home = res.home;
    renderNext(); renderMedList();
    toast(state.lang === 'hi' ? 'पुष्टि दर्ज हुई। परिवार को बता दिया गया।' : 'Confirmed. Your family has been told.');
    el('banner').hidden = true;
  } catch (err) { toast(err.message); }
}

/* -------------------------------------------------------------- report */

async function explainReport() {
  const text = el('reportText').value.trim();
  el('reportNote').textContent = '';
  if (!text) { el('reportNote').textContent = t('reportIntro'); return; }
  try {
    const res = await api.post('/api/reports', { text, title: 'Lab report' });
    if (!res.report) { el('reportNote').textContent = res.note || ''; return; }
    state.report = res.report;
    renderReport(res.report);
    el('reportResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) { el('reportNote').textContent = err.message; }
}

function handleFile(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (file.type.startsWith('image/')) {
    el('reportNote').textContent = state.lang === 'hi'
      ? 'तस्वीर से पढ़ना इस डेमो में बंद है। रिपोर्ट के मान नीचे बॉक्स में लिख दें — जो लिखा जाएगा वही समझाया जाएगा।'
      : 'Reading text from a photo is turned off in this build. Type the values into the box below — CareMate explains only what a person has entered.';
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => { el('reportText').value = String(reader.result).slice(0, 8000); el('reportNote').textContent = ''; };
  reader.readAsText(file);
  e.target.value = '';
}

function renderReport(report) {
  const out = [];
  out.push(`<div class="card-lg">
    <p class="headline">${escapeHtml(report.headline)}</p>
    <button class="btn-listen" id="listenReport" data-speaking="false">
      <span aria-hidden="true">🔊</span><span class="label">${escapeHtml(t('listen'))}</span>
    </button>
    ${report.findings.map(findingHtml).join('')}
  </div>`);
  el('reportResult').innerHTML = out.join('');

  el('listenReport').addEventListener('click', () => {
    if (speech.speaking()) return speech.stop();
    speech.speak(report.spokenText, state.lang);
  });
  el('reportResult').querySelectorAll('[data-story]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelector('.tab[data-tab="story"]').click();
      showStory(btn.dataset.story);
    });
  });
}

function findingHtml(f) {
  const out = f.status !== 'normal';
  return `
    <div class="finding ${out ? 'finding--out' : 'finding--in'}">
      <div class="finding__head">
        <span class="finding__name">${escapeHtml(f.label)}</span>
        <span class="finding__value">${escapeHtml(f.display)} ${escapeHtml(f.unit || '')}</span>
        <span class="finding__flag">${escapeHtml(out ? t('outsideRange') : t('insideRange'))}</span>
      </div>
      <div class="finding__range">${escapeHtml(t('usualRange'))}: ${escapeHtml(f.reference)}</div>
      <dl style="margin:0">
        <dt>${escapeHtml(t('whatItIs'))}</dt><dd>${escapeHtml(f.what)}</dd>
        <dt>${escapeHtml(t('whatItMeans'))}</dt><dd>${escapeHtml(f.meaning)}</dd>
        <dt>${escapeHtml(t('askDoctor'))}</dt><dd>${escapeHtml(f.ask)}</dd>
      </dl>
      ${f.story ? `<button class="btn-ghost" data-story="${escapeHtml(f.story)}">${escapeHtml(t('storyBtn'))}</button>` : ''}
    </div>`;
}

/* ----------------------------------------------------------- storycare */

async function loadStories() {
  const res = await api.get('/api/stories?lang=' + state.lang).catch(() => ({ stories: [] }));
  state.stories = res.stories || [];
  el('topicList').innerHTML = state.stories.map((s) =>
    `<button class="topic" data-key="${escapeHtml(s.key)}" aria-pressed="false">${escapeHtml(s.concept)}</button>`).join('');
  el('topicList').querySelectorAll('.topic').forEach((btn) => {
    btn.addEventListener('click', () => showStory(btn.dataset.key));
  });
}

async function showStory(key) {
  speech.stop();
  const res = await api.post('/api/story', { key, lang: state.lang }).catch(() => null);
  if (!res) return;
  if (res.urgent) { renderPlain(res.text, true); return; }
  if (!res.story) { renderPlain(res.note); return; }

  state.story = res.story;
  document.querySelectorAll('.topic').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.key === key)));
  el('storyResult').innerHTML = `
    <div class="story">
      <h3>${escapeHtml(res.story.concept)}</h3>
      <p>${escapeHtml(res.story.picture)}</p>
      <p>${escapeHtml(res.story.mechanism)}</p>
      <p class="why">${escapeHtml(res.story.why)}</p>
    </div>
    <div class="card-lg">
      <button class="btn-listen" id="listenStory" data-speaking="false" style="margin:0">
        <span aria-hidden="true">🔊</span><span class="label">${escapeHtml(t('listen'))}</span>
      </button>
    </div>`;
  el('listenStory').addEventListener('click', () => {
    if (speech.speaking()) return speech.stop();
    speech.speak(res.spokenText, state.lang);
  });
  el('storyResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function askWord() {
  const question = el('askInput').value.trim();
  if (!question) return;
  const res = await api.post('/api/ask', { question, lang: state.lang }).catch(() => null);
  if (!res) return;
  if (res.story) { showStory(res.story.key); el('askInput').value = ''; return; }
  renderPlain(res.answer, res.urgent);
  el('askInput').value = '';
}

function renderPlain(text, urgent) {
  el('storyResult').innerHTML = `
    <div class="story" ${urgent ? 'style="border-color:#9A2D20;background:#FDF0EE"' : ''}>
      <p style="margin:0">${escapeHtml(text)}</p>
    </div>`;
  if (urgent) speech.speak(text, state.lang);
  el('storyResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* -------------------------------------------------------------- family */

function renderFamily() {
  el('careCode').textContent = state.user.inviteCode || '------';
  const links = state.home.links || [];
  if (!links.length) {
    el('linkList').innerHTML = `<p style="color:var(--ink-soft)">${escapeHtml(t('noFamily'))}</p>`;
    return;
  }
  el('linkList').innerHTML = links.map((l) => {
    const label = l.status === 'active' ? t('active') : l.status === 'pending' ? t('pending') : t('revoked');
    const cls = l.status === 'active' ? 'is-active' : l.status === 'pending' ? 'is-pending' : '';
    const action = l.status === 'pending'
      ? `<button class="btn-allow" data-approve="${l.id}">${escapeHtml(t('allow'))}</button>`
      : l.status === 'active'
        ? `<button class="btn-danger" data-revoke="${l.id}">${escapeHtml(t('revoke'))}</button>` : '';
    return `
      <div class="link-row ${cls}">
        <div class="link-row__name">${escapeHtml(t('sharingWith'))} ${escapeHtml(l.caregiverName)}
          <div class="med__sub">${escapeHtml(label)}</div>
        </div>
        ${action}
      </div>`;
  }).join('');

  el('linkList').querySelectorAll('[data-approve]').forEach((b) =>
    b.addEventListener('click', async () => { await api.post('/api/link/approve', { id: b.dataset.approve }); refresh(); }));
  el('linkList').querySelectorAll('[data-revoke]').forEach((b) =>
    b.addEventListener('click', () => confirmRevoke(b.dataset.revoke)));
}

function confirmRevoke(id) {
  el('modalTitle').textContent = t('revokeTitle');
  el('modalBody').textContent = t('revokeBody');
  el('modalCancel').textContent = t('cancel');
  el('modalConfirm').textContent = t('confirmRevoke');
  el('overlay').hidden = false;
  el('modalConfirm').focus();

  const close = () => { el('overlay').hidden = true; el('modalCancel').onclick = null; el('modalConfirm').onclick = null; };
  el('modalCancel').onclick = close;
  el('modalConfirm').onclick = async () => {
    close();
    await api.post('/api/link/revoke', { id }).catch(() => {});
    refresh();
    toast(state.lang === 'hi' ? 'साझा करना बंद कर दिया गया।' : 'Sharing has been stopped.');
  };
}

/* --------------------------------------------------------------- alerts */

async function pollAlerts() {
  const res = await api.get('/api/alerts').catch(() => null);
  if (!res) return;
  const open = res.alerts.filter((a) => !a.resolved && a.kind !== 'confirmed');
  el('banner').hidden = open.length === 0;
  if (open.length) el('bannerText').textContent = open[0].body;
  for (const a of open) notifier.show(a);
  refresh();
}

let toastTimer;
function toast(message) {
  const node = el('toast');
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, 4200);
}
