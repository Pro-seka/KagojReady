# KagojReady (কাগজ রেডি)

**A Bangla and English assistant that makes public services easier to understand and access. Every answer shows where its information comes from, or honestly says "I don't know."**

KagojReady is a **pre-check, never an approval**. Final decisions stay with the responsible authorities.

## What it does

| Tool | Purpose |
|---|---|
| **Ask** | Guidance from official and reported sources, each shown with its date and status. Understands typos and romanized Bangla. Says so plainly when a service is not covered yet. |
| **Check documents** | Photograph your documents. A vision model reads them and readable, sourced rules decide. Two services today: **adult passport renewal** and **NID correction**. Their rules are marked *draft* until a named person verifies them. Includes a printable visit checklist with no personal data. |
| **Fill a form** | Checks each field as you type or speak (NID, mobile number, dates, names). Runs only on your device. |
| **Plain language** | Paste a notice or bill: difficulty, deadlines, amounts, penalties, hard words explained, and an AI rewrite where every point links to its source sentence and passes a number check. |
| **Report a problem** | Photo, AI-suggested category that **you confirm**, optional rounded location, duplicate detection ("me too"), tracking code, and a token-protected agency console. Ten local issue types. |

## Quick start

Requires Node.js 20 or newer.

```
npm install
npm run demo          # open http://localhost:3000
```

Demo mode needs no key and no internet. Answers come from the sources without AI. The document check does not read photos in demo mode (it alternates between "looks ready" and "mismatch"), and the report form asks you to choose the category. The agency console is at `/agency.html` and an anonymous dashboard at `/insights.html`; both tokens are printed when the server starts.

### With a real AI model

```
cp .env.example .env      # Windows: copy .env.example .env, then add GEMINI_API_KEY
npm run check:llm         # tests the key and reads two sample photos
npm run start:dev
```

Step-by-step guide: `docs/LOCAL_SETUP.md`. Free AI tiers may use what you send, so use only the sample photos in `testdata/specimens/`. Providers: Gemini, Claude, or any OpenAI-compatible local server (`LLM_PROVIDER=local`) so data can stay inside your own infrastructure.

## Verification (run these yourself)

| Command | Result when this version was packaged |
|---|---|
| `npm test` | 391 tests pass (engine, retrieval, plain language, reports, server, UI) |
| `npm run e2e` | 91 real-browser checks pass in Chromium, including accessibility (WCAG 2.x A/AA) scans, no CSP violations, no browser storage, and photo location data removed |
| `npm run eval:rag`, `npm run eval:noisy` | Retrieval recall 100% / 95% / 91% on three small sets. On typo and romanized-Bangla questions it rose from 40% to 100%. No off-topic question was answered |

These test sets are small and written by the team, so treat them as regression checks, not benchmarks. Not yet measured: accuracy on real photos and on the AI category suggestion (`npm run eval:live` needs an API key), and any real-user outcome.

## Privacy

No accounts, cookies or browser storage. Chat, document photos, plain-language text and the form coach store nothing; only civic reports are stored (opt-in in production). Personal numbers are hidden before any text reaches an AI. Photos lose their location data on the phone and again on the server. Report locations are rounded to about 110 m. Public tracking shows only status and office, never a report's text, place or photo. Details and known limits: `docs/ETHICS_AND_LIMITS.md`.

## Honest limits

- Rules for the two services are **drafts** until verified by a named person (`npm run verify-sheet`, `npm run promote-pack`).
- The report routing table and the plain-language glossary are drafts awaiting expert review.
- Reports go to KagojReady's own agency console and CSV export; they are **not** sent into any government system.
- The AI rewrite check covers numbers and sources, not meaning, so every point links to its original sentence.
- `npm run readiness` reports **NO-GO for production** until people-dependent gates (verification, live accuracy, user tests) are closed.

## Project layout

```
public/    front end (plain JavaScript, no build step): app.js, lanes/, lib/validate.mjs, agency page, dashboard
src/       server, answer pipeline, retrieval, plain language, civic reports, rules engine, privacy and security controls
kb/        knowledge passages, glossary, out-of-scope services, report categories and routing (draft)
packs/     the rules for each document-check service
evidence/  templates and records for the human-evidence gates (interviews, user tests, verification)
tests/ eval/ e2e/   automated tests, retrieval evaluations, real-browser suite
scripts/   tooling (screenshots, readiness report, pack scaffolding, ingestion)
docs/      LOCAL_SETUP, ARCHITECTURE, ADD_A_SERVICE, ETHICS_AND_LIMITS, rule-verification templates
```

Adding a service is a data file, not code: see `docs/ADD_A_SERVICE.md`. Architecture: `docs/ARCHITECTURE.md`.
