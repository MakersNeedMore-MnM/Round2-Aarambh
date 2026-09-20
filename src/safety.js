/**
 * safety.js — every piece of health text leaves the server through here.
 *
 * Three rules from the product spec, enforced as code rather than as a slide:
 *   1. Non-diagnostic   — explain, never name a disease as the user's own.
 *   2. Verified sources — medication instructions come from a confirmed
 *                         prescription, never from generated text.
 *   3. Escalation       — red-flag wording always returns the urgent-care line.
 */

const DIAGNOSTIC_PATTERNS = [
  /\byou (?:have|are suffering from|are diagnosed with)\b/i,
  /\bthis (?:means|confirms) (?:you|that you) (?:have|are)\b/i,
  /\bdiagnos(?:is|ed|e)\b/i,
  /\byou (?:are|appear to be) (?:diabetic|hypertensive|anaemic|anemic)\b/i
];

const PRESCRIPTIVE_PATTERNS = [
  /\b(?:take|start|stop|increase|decrease|double|skip)\s+(?:your\s+)?(?:\d+\s*(?:mg|ml|tablet|tablets|gram|g)\b|medicine|medication|dose|tablet)/i,
  /\byou should (?:take|stop|start|change)\b/i,
  /\bi recommend (?:taking|stopping|starting)\b/i,
  /\b\d+\s*(?:mg|mcg|ml)\b.*\b(?:daily|twice|thrice|per day)\b/i
];

const RED_FLAG_PATTERNS = [
  /chest pain|seene? me[n]? dard|सीने में दर्द/i,
  /can'?t breathe|breathless|saans? nahi|साँस नहीं|साँस लेने में/i,
  /unconscious|fainted|बेहोश/i,
  /slurred speech|face droop|one side weak|लकवा|बोलने में दिक्कत/i,
  /bleeding heavily|खून बह/i,
  /suicid|खुदकुशी|आत्महत्या/i
];

const DISCLAIMER = {
  en: 'CareMate explains information. It does not diagnose, and it does not replace your doctor.',
  hi: 'केयरमेट जानकारी समझाता है। यह रोग नहीं बताता और आपके डॉक्टर की जगह नहीं लेता।'
};

const URGENT = {
  en: 'Some of what you described can need urgent medical attention. Please contact your doctor or local emergency services now, and tell someone who is with you.',
  hi: 'आपने जो बताया, उसके लिए तुरंत चिकित्सा सहायता ज़रूरी हो सकती है। कृपया अभी अपने डॉक्टर या आपातकालीन सेवा से संपर्क करें और पास मौजूद किसी व्यक्ति को बताएँ।'
};

function containsRedFlag(text) {
  return RED_FLAG_PATTERNS.some((re) => re.test(String(text || '')));
}

/**
 * Scrub text of diagnostic/prescriptive phrasing.
 * Returns { text, blocked, flags } — blocked text is replaced, never shipped.
 */
function scrub(text, lang) {
  const L = lang === 'hi' ? 'hi' : 'en';
  const flags = [];
  let out = String(text || '');

  for (const re of DIAGNOSTIC_PATTERNS) {
    if (re.test(out)) {
      flags.push('diagnostic');
      out = out.replace(re, L === 'hi' ? 'यह जाँच बताती है कि' : 'this result shows that');
    }
  }
  for (const re of PRESCRIPTIVE_PATTERNS) {
    if (re.test(out)) {
      flags.push('prescriptive');
      out = L === 'hi'
        ? 'यह सवाल दवा की खुराक से जुड़ा है। केयरमेट खुराक नहीं बता सकता। कृपया अपने डॉक्टर या फ़ार्मासिस्ट से पूछें।'
        : 'That question is about a medicine dose. CareMate cannot give doses. Please ask your doctor or pharmacist.';
      return { text: out, blocked: true, flags: Array.from(new Set(flags)) };
    }
  }
  return { text: out, blocked: false, flags: Array.from(new Set(flags)) };
}

function guard(text, lang) {
  const L = lang === 'hi' ? 'hi' : 'en';
  if (containsRedFlag(text)) {
    return { urgent: true, text: URGENT[L], disclaimer: DISCLAIMER[L] };
  }
  const cleaned = scrub(text, L);
  return { urgent: false, text: cleaned.text, blocked: cleaned.blocked, flags: cleaned.flags, disclaimer: DISCLAIMER[L] };
}

module.exports = { guard, scrub, containsRedFlag, DISCLAIMER, URGENT };
