# Architecture

## Principles
1. **AI reads, rules decide.** Models turn photos and text into structured data or short summaries. Pass/fail logic lives in readable rule files with sources.
2. **Never trust, always check.** Every model output is validated: citations and numbers against passages, rewrite points against their own source sentence, categories against a fixed list, JSON against a schema.
3. **Abstain by design.** Low coverage, unknown services, failed validation and model outages all end in a clear "not sure" or the raw sources, never a confident guess.
4. **Minimum data.** No accounts. Chat, checks, plain-language and the form coach store nothing. Civic reports are the only stored data, are opt-in in production, and keep the least that is useful.
5. **Everything optional that needs a model degrades to a working non-AI path.**

## Request paths

### Ask (`src/assistant/answer.ts`)
redact personal numbers → out-of-scope guard (`kb/out-of-scope.json`, counts only the service id) → `rewriteQuery` (romanized Bangla → Bangla words; a word the KB has never seen is replaced only if a known word is within 1 to 2 slips) → BM25 with bilingual thesaurus → coverage gate → AI answer from numbered passages → verify every citation and number → else show passages. A "How I answered" trail records each step.

### Check documents (`src/extract`, `src/rules`)
photo downscaled and stripped of metadata in the browser → vision model returns structured fields with confidence → deterministic rules compare fields → verdict with the rule, status and source for each flag. Unreadable or unexpected documents give UNSURE, never a pass.

### Plain language (`src/plain`)
`analyze` (no AI): sentence split, facts (amounts, percentages, dates, time limits, duties, prohibitions, penalties, matched on a digit-normalised copy so Bangla digits work), glossary match (49 terms, word-boundary aware), readability heuristic, extractive summary. Optional `groundedRewrite`: the model must return `{text, sentence}` points; a point is kept only if it cites a real sentence and every number in it appears in that sentence.

### Report (`src/reports`)
`classify` returns a suggestion only above 0.6 confidence and only from a fixed id list. `create`: category and area validated, location rounded to ~110 m and accepted only inside Bangladesh, description redacted, photo stripped of all metadata segments on the server, duplicate search (same category, open, within 60 m, 21 days), tracking code `KR-XXXX-XXXX` (no look-alike characters). `TicketStore` is a 6-method interface; the pilot store is an append-only JSONL file plus a photo folder. Retention purge runs at start and every 6 h.

### Form coach (`public/lib/validate.mjs`)
Pure functions loaded by the browser, exercised by Node tests, and compared against the server's date parser in a parity test. No network calls (asserted in the browser suite).

## Security and privacy controls
Strict CSP (`default-src 'none'`, scripts and styles from self only, no inline), `Permissions-Policy` allowing location only for this origin, no cookies or browser storage (asserted), clickjacking blocked, per-IP rate limits scaled from one setting, agency token compared in constant time with a failed-attempt lockout that never counts valid requests, CSV export neutralises spreadsheet formulas, path traversal tests on static files and photo reads, production start-up refuses demo mode, free AI tier, missing keys and draft packs.

## Scaling path
A new service is a pack file plus knowledge cards. A new country is a new pack set. Multi-instance needs three swaps, all behind small interfaces: shared rate-limit store, database-backed `TicketStore`, and an object store for photos. The local-model provider keeps all data inside a chosen infrastructure.
