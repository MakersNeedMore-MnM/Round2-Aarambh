/**
 * seed.js — demo data.
 *
 * Creates two linked accounts with fourteen days of plausible history, so the
 * caregiver dashboard has something honest to show on first load instead of an
 * empty state. Runs once; existing data is never overwritten.
 */
const store = require('../src/store');
const auth = require('../src/auth');
const extract = require('../src/extract');
const scheduler = require('../src/scheduler');

const DEMO_SENIOR = { name: 'Suresh Kumar', email: 'senior@caremate.app', password: 'caremate123', role: 'senior', language: 'en' };
const DEMO_FAMILY = { name: 'Neha Kumar', email: 'family@caremate.app', password: 'caremate123', role: 'caregiver', language: 'en' };

const SAMPLE_REPORT = `City Diagnostics — Lab Report
Patient: Suresh Kumar
HbA1c: 8.2 %
Fasting glucose: 142 mg/dL
eGFR: 64 mL/min
Creatinine: 1.2 mg/dL
LDL cholesterol: 138 mg/dL
HDL cholesterol: 44 mg/dL
Haemoglobin: 13.4 g/dL
Vitamin D: 18 ng/mL
TSH: 3.1 uIU/mL`;

function ensureDemoData() {
  if (store.findOne('users', (u) => u.email === DEMO_SENIOR.email)) return false;

  const senior = auth.createUser(DEMO_SENIOR);
  const family = auth.createUser(DEMO_FAMILY);

  const meds = [
    { medicine: 'Amlodipine', dose: '5 mg', time: '08:30', instruction: 'after breakfast', criticality: 'critical' },
    { medicine: 'Metformin', dose: '500 mg', time: '13:30', instruction: 'after lunch', criticality: 'critical' },
    { medicine: 'Atorvastatin', dose: '10 mg', time: '21:00', instruction: 'after dinner', criticality: 'routine' },
    { medicine: 'Cholecalciferol', dose: '60000 iu', time: '09:00', instruction: 'after food', criticality: 'routine', weeklyOnly: true }
  ];

  const prescriptions = meds.filter((m) => !m.weeklyOnly).map((m) =>
    store.insert('prescriptions', {
      seniorId: senior.id,
      medicine: m.medicine,
      dose: m.dose,
      time: m.time,
      instruction: m.instruction,
      criticality: m.criticality,
      source: 'prescription',
      verified: true,
      verifiedBy: senior.id,
      stopped: false,
      prescriber: 'Dr. A. Menon, General Medicine'
    })
  );

  const link = store.insert('links', {
    seniorId: senior.id,
    caregiverId: family.id,
    status: 'active',
    approvedAt: daysAgo(21).toISOString(),
    revokedAt: null
  });

  buildHistory(senior.id, prescriptions);
  scheduler.ensureDoses();

  const parsed = extract.parseReport(SAMPLE_REPORT);
  const report = store.insert('reports', {
    seniorId: senior.id,
    title: 'Lab report — City Diagnostics',
    rawText: SAMPLE_REPORT,
    findings: parsed.findings,
    shared: true,
    reportDate: daysAgo(16).toISOString()
  });
  store.update('reports', report.id, { createdAt: daysAgo(16).toISOString() });

  addTimeline(senior.id, daysAgo(16), 'report', 
    { en: 'Baseline lab report scanned', hi: 'पहली लैब रिपोर्ट स्कैन हुई' },
    { en: 'HbA1c 8.2 %, LDL 138 mg/dL and vitamin D 18 ng/mL were outside the usual range', hi: 'एचबीए1सी 8.2 %, एलडीएल 138 और विटामिन डी 18 सामान्य सीमा से बाहर' },
    { reportId: report.id });

  addTimeline(senior.id, daysAgo(13), 'consultation',
    { en: 'Doctor consultation', hi: 'डॉक्टर से मुलाक़ात' },
    { en: 'Prescription revised by Dr. A. Menon. Metformin added at lunch.', hi: 'डॉ. ए. मेनन ने नुस्खा बदला। दोपहर में मेटफॉर्मिन जोड़ी गई।' });

  addTimeline(senior.id, daysAgo(21), 'consent',
    { en: 'Sharing turned on', hi: 'साझा करना चालू' },
    { en: 'Neha Kumar was given access to medicine confirmations and shared reports.', hi: 'नेहा कुमार को दवा की पुष्टि और साझा रिपोर्ट देखने की अनुमति मिली।' });

  const a14 = scheduler.adherence(senior.id, 14);
  addTimeline(senior.id, daysAgo(1), 'checkpoint',
    { en: '14-day consistency checkpoint', hi: '14-दिन की नियमितता जाँच' },
    { en: `${a14.percent}% of scheduled doses were confirmed`, hi: `${a14.percent}% निर्धारित खुराकों की पुष्टि हुई` });

  addTimeline(senior.id, daysFromNow(45), 'upcoming',
    { en: 'Three-month HbA1c review due', hi: 'तीन महीने की एचबीए1सी जाँच' },
    { en: 'Suggested by the reporting lab on the previous report', hi: 'पिछली रिपोर्ट में लैब द्वारा सुझाया गया' });

  store.flush();
  console.log('  Demo accounts created (senior@caremate.app / family@caremate.app, password caremate123)');
  return true;
}

/** 14 days of doses with a believable adherence pattern, not a perfect one. */
function buildHistory(seniorId, prescriptions) {
  const missPattern = new Set(['4:21:00', '9:21:00', '2:13:30', '11:21:00', '6:21:00']);
  for (let i = 14; i >= 1; i--) {
    const date = daysAgo(i);
    const dayKey = scheduler.todayKey(date);
    for (const p of prescriptions) {
      const scheduledFor = scheduler.scheduledDate(dayKey, p.time);
      const unconfirmed = missPattern.has(`${i}:${p.time}`);
      const confirmedAt = unconfirmed ? null : new Date(scheduledFor.getTime() + (3 + Math.floor(Math.random() * 22)) * 60000);
      const row = store.insert('doses', {
        seniorId,
        prescriptionId: p.id,
        day: dayKey,
        scheduledFor: scheduledFor.toISOString(),
        medicine: p.medicine,
        dose: p.dose,
        instruction: p.instruction,
        criticality: p.criticality,
        status: unconfirmed ? 'awaiting_confirmation' : 'confirmed',
        confirmedAt: confirmedAt ? confirmedAt.toISOString() : null,
        escalatedAt: unconfirmed ? new Date(scheduledFor.getTime() + 45 * 60000).toISOString() : null
      });
      store.update('doses', row.id, { createdAt: scheduledFor.toISOString() });
    }
  }
}

function addTimeline(seniorId, when, type, title, detail, extra) {
  const row = store.insert('timeline', Object.assign({ seniorId, type, title, detail, at: when.toISOString() }, extra || {}));
  store.update('timeline', row.id, { createdAt: when.toISOString() });
  return row;
}

function daysAgo(n) { return new Date(Date.now() - n * 86400000); }
function daysFromNow(n) { return new Date(Date.now() + n * 86400000); }

module.exports = { ensureDemoData, SAMPLE_REPORT };
