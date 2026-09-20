/**
 * scheduler.js — medication timing, confirmation and escalation.
 *
 * The single most important rule in this file:
 *
 *      NOT CONFIRMED  !=  MISSED
 *
 * The app knows only what a person told it. Silence means the app does not
 * know. Every label, alert and API field below preserves that distinction,
 * because telling a worried grandchild in another city that a dose was
 * "missed" when it was merely unconfirmed is how a product loses trust.
 *
 * Escalation windows are set by the medicine's criticality, taken from the
 * prescription, not guessed:
 *      critical medicines  -> family is told after 30 minutes
 *      routine medicines   -> family is told after 60 minutes
 */
const store = require('./store');

const GRACE_MINUTES = { critical: 30, routine: 60 };

function todayKey(d = new Date()) {
  const dt = d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function scheduledDate(dayKey, hhmm) {
  const [y, m, d] = dayKey.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

/** Create the day's dose rows for every verified prescription. Idempotent. */
function ensureDoses(dayKey = todayKey()) {
  const prescriptions = store.find('prescriptions', (p) => p.verified && !p.stopped);
  let created = 0;
  for (const p of prescriptions) {
    const exists = store.findOne('doses', (d) => d.prescriptionId === p.id && d.day === dayKey);
    if (exists) continue;
    store.insert('doses', {
      seniorId: p.seniorId,
      prescriptionId: p.id,
      day: dayKey,
      scheduledFor: scheduledDate(dayKey, p.time).toISOString(),
      medicine: p.medicine,
      dose: p.dose,
      instruction: p.instruction || '',
      criticality: p.criticality || 'routine',
      status: 'pending',
      confirmedAt: null,
      escalatedAt: null
    });
    created++;
  }
  return created;
}

function graceFor(dose) {
  return GRACE_MINUTES[dose.criticality] || GRACE_MINUTES.routine;
}

function dueState(dose, now = new Date()) {
  const at = new Date(dose.scheduledFor);
  const mins = (now - at) / 60000;
  if (mins < -30) return 'upcoming';
  if (mins < 0) return 'soon';
  if (mins <= graceFor(dose)) return 'due';
  return 'overdue';
}

/**
 * Advance dose states and raise family alerts.
 * Called on a timer and opportunistically before any read of the schedule,
 * so the demo is correct even if the process was asleep.
 */
function tick(now = new Date()) {
  ensureDoses(todayKey(now));
  const pending = store.find('doses', (d) => d.status === 'pending');
  const events = [];

  for (const dose of pending) {
    if (dueState(dose, now) !== 'overdue') continue;
    store.update('doses', dose.id, { status: 'awaiting_confirmation', escalatedAt: now.toISOString() });

    // Nudge the senior first — the family is the second line, not the first.
    raiseAlert({
      seniorId: dose.seniorId,
      audience: 'senior',
      kind: 'reminder',
      doseId: dose.id,
      title: { en: 'Still waiting on your medicine', hi: 'आपकी दवा का इंतज़ार है' },
      body: {
        en: `${dose.medicine} ${dose.dose} was due at ${fmtTime(dose.scheduledFor)}. Tap "I have taken it" once you have.`,
        hi: `${dose.medicine} ${dose.dose} का समय ${fmtTime(dose.scheduledFor)} था। दवा लेने के बाद "मैंने ले ली है" दबाएँ।`
      },
      severity: dose.criticality === 'critical' ? 'high' : 'normal'
    });

    for (const link of activeLinks(dose.seniorId)) {
      raiseAlert({
        seniorId: dose.seniorId,
        caregiverId: link.caregiverId,
        audience: 'caregiver',
        kind: 'no_confirmation',
        doseId: dose.id,
        title: { en: 'Gentle follow-up', hi: 'हल्का अनुस्मारक' },
        body: {
          en: `No confirmation for ${dose.medicine} ${dose.dose}, due at ${fmtTime(dose.scheduledFor)}. This is not a missed dose — it means no confirmation has been received yet.`,
          hi: `${dose.medicine} ${dose.dose} की पुष्टि नहीं मिली, समय ${fmtTime(dose.scheduledFor)} था। इसका मतलब खुराक छूटी नहीं, सिर्फ़ पुष्टि अभी नहीं मिली है।`
        },
        severity: dose.criticality === 'critical' ? 'high' : 'normal'
      });
    }
    events.push(dose.id);
  }
  return events;
}

function confirmDose(doseId, seniorId, now = new Date()) {
  const dose = store.findOne('doses', (d) => d.id === doseId && d.seniorId === seniorId);
  if (!dose) return null;
  if (dose.status === 'confirmed') return dose;
  const updated = store.update('doses', dose.id, { status: 'confirmed', confirmedAt: now.toISOString() });

  for (const link of activeLinks(seniorId)) {
    raiseAlert({
      seniorId,
      caregiverId: link.caregiverId,
      audience: 'caregiver',
      kind: 'confirmed',
      doseId: dose.id,
      title: { en: 'Medicine confirmed', hi: 'दवा की पुष्टि' },
      body: {
        en: `${dose.medicine} ${dose.dose} confirmed at ${fmtTime(updated.confirmedAt)}.`,
        hi: `${dose.medicine} ${dose.dose} की पुष्टि ${fmtTime(updated.confirmedAt)} पर हुई।`
      },
      severity: 'info'
    });
  }
  // Resolve the senior's own nudge so the screen does not keep shouting.
  for (const a of store.find('alerts', (a) => a.doseId === dose.id && a.audience === 'senior' && !a.resolved)) {
    store.update('alerts', a.id, { resolved: true });
  }
  return updated;
}

function activeLinks(seniorId) {
  return store.find('links', (l) => l.seniorId === seniorId && l.status === 'active');
}

function raiseAlert(spec) {
  const dupe = store.findOne('alerts', (a) =>
    a.doseId === spec.doseId && a.kind === spec.kind && a.audience === spec.audience && a.caregiverId === (spec.caregiverId || null)
  );
  if (dupe) return dupe;
  return store.insert('alerts', Object.assign({ caregiverId: null, read: false, resolved: false }, spec));
}

function fmtTime(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
}

/** Adherence = confirmed / scheduled-and-past, over a window of days. */
function adherence(seniorId, days = 14, now = new Date()) {
  const cutoff = new Date(now.getTime() - days * 86400000);
  const doses = store.find('doses', (d) =>
    d.seniorId === seniorId && new Date(d.scheduledFor) >= cutoff && new Date(d.scheduledFor) <= now);
  const total = doses.length;
  const confirmed = doses.filter((d) => d.status === 'confirmed').length;
  return {
    days,
    total,
    confirmed,
    unconfirmed: total - confirmed,
    percent: total ? Math.round((confirmed / total) * 100) : null
  };
}

function start(intervalMs = 30000) {
  tick();
  const timer = setInterval(() => {
    try { tick(); } catch (err) { console.error('[scheduler] tick failed', err); }
  }, intervalMs);
  if (timer.unref) timer.unref();
  return timer;
}

module.exports = { start, tick, ensureDoses, confirmDose, dueState, adherence, todayKey, scheduledDate, fmtTime, GRACE_MINUTES, activeLinks, raiseAlert };
