/**
 * extract.js — the OCR + extraction stage.
 *
 * Text layer: real parsing of report text (typed, pasted, or .txt upload).
 * Image layer: a real OCR engine (Tesseract / a cloud vision API) plugs in at
 * `runOcr` below. Nothing else in the app changes when it does, because
 * everything downstream consumes plain text. For the offline demo an image
 * upload is routed to `confirm-by-hand`, which is also the correct clinical
 * behaviour: unreadable scan, ask the human, never guess a number.
 */
const medical = require('./medical');

const OCR_PROVIDER = process.env.CAREMATE_OCR || 'none';

async function runOcr(buffer, filename) {
  if (OCR_PROVIDER === 'none') {
    return {
      ok: false,
      reason: 'ocr_unavailable',
      text: '',
      note: 'Image text was not read automatically. Values must be confirmed by a person before use.'
    };
  }
  // Hook for a real engine:
  //   const { createWorker } = require('tesseract.js');
  //   const worker = await createWorker(['eng', 'hin']);
  //   const { data } = await worker.recognize(buffer);
  //   return { ok: true, text: data.text };
  throw new Error('Unknown OCR provider: ' + OCR_PROVIDER);
}

/** Lines like "HbA1c : 8.2 %", "eGFR 64 mL/min", "BP 148/92 mmHg". */
const VALUE_LINE = /^\s*([A-Za-z][A-Za-z0-9 ()/.,'\-+]{1,48}?)\s*[:\-–]?\s*(\d{1,3}(?:\/\d{1,3})?(?:\.\d{1,2})?)\s*([A-Za-z%µ/²³.\^\-0-9]*)\s*(?:\((?:[^)]*)\))?\s*$/;

function parseReport(text) {
  const lines = String(text || '').split(/\r?\n/);
  const findings = [];
  const seen = new Set();
  const unmatched = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.length > 120) continue;
    const m = line.match(VALUE_LINE);
    if (!m) continue;
    const name = m[1].trim();
    const rawValue = m[2];
    const unit = (m[3] || '').trim();

    const analyte = medical.findAnalyte(name);
    if (!analyte) { unmatched.push({ name, value: rawValue, unit }); continue; }
    if (seen.has(analyte.key)) continue;
    seen.add(analyte.key);

    let value, display;
    if (rawValue.includes('/')) {
      const [sys, dia] = rawValue.split('/').map(Number);
      value = sys;
      display = `${sys}/${dia}`;
      findings.push(buildFinding(analyte, value, display, unit || analyte.unit, { systolic: sys, diastolic: dia }));
    } else {
      value = parseFloat(rawValue);
      if (Number.isNaN(value)) continue;
      display = rawValue;
      findings.push(buildFinding(analyte, value, display, unit || analyte.unit, null));
    }
  }

  const order = { attention: 0, watch: 1, normal: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  return { findings, unmatched };
}

function buildFinding(analyte, value, display, unit, extra) {
  const status = medical.classify(analyte, value);
  const severity = medical.severity(analyte, value, status);
  return {
    key: analyte.key,
    label: analyte.label,
    labelHi: analyte.labelHi,
    value,
    display,
    unit,
    status,
    severity,
    story: analyte.story,
    reference: analyte.invert ? `≥ ${analyte.low} ${analyte.unit}` : `${analyte.low}–${analyte.high} ${analyte.unit}`,
    extra: extra || undefined
  };
}

/**
 * Prescription parsing.
 * Handles the shapes found on Indian OPD slips:
 *   "Tab. Amlodipine 5 mg - 1-0-0 after breakfast"
 *   "Metformin 500mg twice daily before food"
 *   "Atorvastatin 10 mg  1 tablet at night"
 */
const TIMING_WORDS = [
  { re: /1\s*-\s*0\s*-\s*0/, slots: ['08:30'] },
  { re: /0\s*-\s*1\s*-\s*0/, slots: ['13:30'] },
  { re: /0\s*-\s*0\s*-\s*1/, slots: ['21:00'] },
  { re: /1\s*-\s*0\s*-\s*1/, slots: ['08:30', '21:00'] },
  { re: /1\s*-\s*1\s*-\s*1/, slots: ['08:30', '13:30', '21:00'] },
  { re: /\b(?:twice a day|twice daily|bd|b\.d\.|2\s*times)\b/i, slots: ['08:30', '21:00'] },
  { re: /\b(?:thrice daily|three times|tds|t\.d\.s\.)\b/i, slots: ['08:30', '13:30', '21:00'] },
  { re: /\b(?:at night|bedtime|hs|h\.s\.|night)\b/i, slots: ['21:00'] },
  { re: /\b(?:morning|breakfast|subah|od|o\.d\.|once daily|daily)\b/i, slots: ['08:30'] },
  { re: /\b(?:afternoon|lunch|dopahar)\b/i, slots: ['13:30'] },
  { re: /\b(?:evening|shaam|dinner)\b/i, slots: ['19:30'] }
];

/**
 * Criticality decides how long we wait before telling the family.
 * Sourced from drug class, not from a model's opinion.
 */
const CRITICAL_CLASSES = [
  /insulin|glargine|humalog/i,
  /warfarin|acitrom|acenocoumarol|apixaban|rivaroxaban|dabigatran/i,
  /digoxin/i,
  /levothyroxine|thyronorm|eltroxin/i,
  /clopidogrel|ecosprin|aspirin/i,
  /amlodipine|telmisartan|losartan|metoprolol|atenolol|ramipril|enalapril/i,
  /metformin|glimepiride|gliclazide|sitagliptin|glipizide/i,
  /levetiracetam|phenytoin|carbamazepine|valproate/i,
  /prednisolone|hydrocortisone/i
];

function criticalityFor(name) {
  return CRITICAL_CLASSES.some((re) => re.test(name)) ? 'critical' : 'routine';
}

const MED_LINE = /^\s*(?:tab\.?|tabs\.?|cap\.?|caps\.?|syr\.?|syp\.?|susp\.?|inj\.?|oint\.?|drops?|tablet|capsule|syrup)?\s*([A-Za-z][A-Za-z\-\s]{2,40}?)\s+(\d+(?:\.\d+)?)\s*(mg|mcg|ml|g|iu|units?)\b(.*)$/i;

function parsePrescription(text) {
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^(?:dr|clinic|hospital|patient|date|age|sex|rx|advice|follow)/i.test(line)) continue;
    const m = line.match(MED_LINE);
    if (!m) continue;
    const name = m[1].replace(/\s+/g, ' ').trim();
    if (name.length < 3) continue;
    const dose = `${m[2]} ${m[3].toLowerCase()}`;
    const rest = (m[4] || '').trim();

    let slots = null;
    for (const t of TIMING_WORDS) { if (t.re.test(line)) { slots = t.slots; break; } }
    if (!slots) slots = ['08:30'];

    // Keep the prescriber's own wording; "after breakfast" is a clearer
    // instruction to an 8:30 reminder than a flattened "after food".
    let instruction = '';
    const meal = rest.match(/\b(?:after|before)\s+(?:food|meal|meals|breakfast|lunch|dinner|khana)\b/i);
    if (meal) instruction = meal[0].toLowerCase();
    else if (/empty stomach/i.test(rest)) instruction = 'on an empty stomach';

    for (const time of slots) {
      out.push({
        medicine: titleCase(name),
        dose,
        time,
        instruction,
        criticality: criticalityFor(name),
        source: 'prescription',
        verified: false
      });
    }
  }
  return out;
}

function titleCase(s) {
  return s.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

module.exports = { runOcr, parseReport, parsePrescription, criticalityFor, OCR_PROVIDER };
