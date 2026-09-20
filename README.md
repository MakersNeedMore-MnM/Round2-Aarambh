# CareMate

**Understand · Learn · Care**

A health companion for an elder and the family member who worries about them,
built around one observation: *the person who needs the care is not always the
person using the technology.*

---

## Run it

```bash
node server.js
```

Then open **http://localhost:3000**

There is no `npm install`, no build step, no API key and no internet
requirement. The app uses Node's built-in modules only and needs Node 18 or
newer. This was a deliberate choice: a prototype that fails at the install step
on a reviewer's locked-down laptop has failed, however good the code is.

```
PORT=8080 node server.js     # if 3000 is taken
node scripts/smoke.js        # headless check of both client bundles
node scripts/reset.js        # wipe the demo data and start clean
```

### Demo accounts

| Mode | Email | Password |
|---|---|---|
| Elder | `senior@caremate.app` | `caremate123` |
| Family | `family@caremate.app` | `caremate123` |

Open the two accounts in two browser windows (use a private window for the
second) to watch a confirmation on one screen appear on the other.

The family account starts already linked, with fourteen days of seeded history
at roughly 88% confirmed — deliberately not 100%, because a perfect chart proves
nothing.

---

## The five-minute demo

1. **Sign in as the elder.** The next medicine is the largest thing on screen.
   Press **Listen** — the browser speaks it. Press **भाषा बदलें** and press
   Listen again; the same content is spoken in Hindi.
2. **Press "I have taken it."**
3. **Switch to the family window.** The confirmation is there with a timestamp.
4. **Wait past a dose time** (or use a medicine scheduled earlier today). The
   elder's screen shows *Not confirmed yet* with the sentence explaining what
   that does and does not mean; the family screen shows *Gentle follow-up*.
5. **Go to "My report"** on the elder's screen, press *Use a sample report*,
   then *Explain this to me*. Each value gets what the test is, what the number
   means, and what to ask the doctor. Press **Tell me the story** on any value.
6. **Go to "Learn"** and type `chest pain` into the ask box. CareMate stops
   explaining and tells you to seek help now.
7. **Go to "Family"** and press **Stop sharing**. Refresh the family window:
   it is empty. Consent is enforced at the data layer, not hidden in the UI.

---

## What is implemented

| Deck feature | Where it lives | Status |
|---|---|---|
| Medical report scanner | `src/extract.js`, `POST /api/reports` | Text extraction, parsing and explanation working. Image OCR is stubbed — see below. |
| AI explanation | `src/medical.js` | 17 analytes with reference bands and plain-language explanations in two languages |
| Safety filter | `src/safety.js` | Non-diagnostic, non-prescriptive, red-flag escalation |
| StoryCare | `src/storycare.js` | 13 curated analogies, three beats each, both languages |
| Voice | `public/js/client.js` | Browser speech synthesis, `hi-IN` and `en-IN` |
| Senior UI | `public/senior.html`, `css/senior.css` | 20px base text, 84px primary button, four tabs |
| Medication confirmation | `src/scheduler.js` | Confirmed / not-confirmed, never "missed" |
| Family Care Link | `POST /api/link/*` | Code → request → elder approves → revocable |
| Consent enforcement | `src/api.js` | Revoking empties the caregiver view immediately |
| Health timeline | `GET /api/timeline` | Reports, consultations, consent changes, checkpoints |
| Prescription verification | `POST /api/prescriptions/read` then `/confirm` | Two-stage: nothing becomes a reminder until a person confirms it |
| Escalation notifications | `src/scheduler.js` | 30 min for time-critical medicines, 60 min for routine |

### The three safety principles, as code

1. **Non-diagnostic.** `safety.js` scrubs diagnostic phrasing from every piece
   of health text leaving the server. A question about a dose is refused
   outright, not answered carefully.
2. **Consent and privacy.** A caregiver's read path goes through an *active*
   link row on every request. There is no cached copy, so revoking is
   instantaneous rather than eventual.
3. **Verified information only.** A medication reminder can only be created by
   `POST /api/prescriptions/confirm`, which requires a signed-in elder to have
   confirmed each line. No code path creates a reminder from generated text.

---

## Two decisions worth defending

**Image OCR is disabled rather than faked.** Uploading a photo routes to
"type the values in by hand" — which is also the correct clinical behaviour for
an unreadable scan: ask the human, never guess a number. The hook is
`extract.js → runOcr`, a dozen lines from working with Tesseract, and nothing
downstream changes when you plug an engine in, because everything downstream
consumes plain text.

**The number-to-meaning step is a curated table, not a language model.** A model
is excellent at phrasing and unaccountable for a number. In CareMate the
classification is fixed in `medical.js` and only the wording would ever be a
candidate for generation. Set `CAREMATE_OCR` and add a model behind `safety.js`
if you want generated phrasing; the safety filter sits between it and the user
by design, not by accident.

---

## Architecture

```
  Browser
    ├── /            sign in and sign up
    ├── /senior      elder mode   — large type, voice, one action at a time
    └── /family      family mode  — monitoring console
                          │
                     JSON over fetch
                          │
                    server.js  (Node http)
                          │
    ┌──────────┬──────────┼───────────┬──────────┐
  auth.js    api.js   scheduler.js  safety.js  extract.js
                          │              │          │
                       store.js     medical.js  storycare.js
                          │
                  data/caremate.json
```

| File | Responsibility |
|---|---|
| `server.js` | HTTP, static files, JSON dispatch, security headers |
| `src/store.js` | Persistent document store, atomic writes, corruption recovery |
| `src/auth.js` | scrypt hashing, constant-time compare, session cookies |
| `src/api.js` | Every route; all authorisation decisions |
| `src/scheduler.js` | Dose generation, grace windows, escalation, adherence |
| `src/medical.js` | Reference ranges and explanations |
| `src/storycare.js` | Analogies |
| `src/safety.js` | The filter every health string passes through |
| `src/extract.js` | Report and prescription parsing; OCR seam |

### Why a JSON store instead of SQLite

The access layer in `store.js` is shaped like a repository
(`insert / find / findOne / update / remove`) precisely so that moving to
SQLite or Postgres touches that one file. For a demo that must run anywhere
with zero setup, a single atomically-written JSON file is the honest trade.
It is not what you would run in production, and the code is arranged so you
would not have to.

---

## Security notes

- Passwords: scrypt with a per-user random salt, compared in constant time.
- Sessions: opaque random tokens, server-side, `HttpOnly` + `SameSite=Lax`.
- Every caregiver read re-checks the consent link; nothing is trusted from the
  client.
- Request bodies are capped at 2 MB; static paths are normalised against
  directory traversal.
- All user-supplied strings are escaped before insertion into the DOM
  (`escapeHtml` in `client.js`).

---

## Known limits

- Image OCR is not wired to an engine (deliberate, see above).
- Browser notifications need the tab to be open and permission granted; a real
  deployment would need a service worker plus web push, or SMS for the elder.
- Speech uses whatever voices the operating system has. Hindi quality varies by
  machine; on a system with no Hindi voice the app falls back to an Indian
  English voice.
- One elder to many caregivers is supported by the data model, but the family
  dashboard shows the first active link only.
- The reference ranges are general adult ranges. Real clinical targets are
  individual, which is why every explanation ends by pointing at the doctor.

---

CareMate explains health information. It does not diagnose, does not prescribe,
and does not replace a doctor.
