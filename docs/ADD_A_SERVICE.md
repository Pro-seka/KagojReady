# Adding a service, a country, or a pile of documents

Adding to KagojReady is data work. You do not change the code.

## A new service (for example birth registration)
1. `npm run new-pack -- --id bd-birth-registration --name-en "Birth registration" --name-bn "জন্মনিবন্ধন" --country BD` writes a valid draft to `packs/drafts/`. It is **not served** while it sits there.
2. Open it. Replace every `TODO`: the documents the person must show, the fields to read, and the rules.
3. Collect the official pages for the service. For each rule, add a source and set `rule_status` honestly: `official`, `operator_reported`, or `unconfirmed`. Unconfirmed rules can only be warnings.
4. Move the file to `packs/`. Restart. It now appears in the service list, the document check, and the knowledge base (each rule becomes a searchable, cited passage).
5. Add labelled questions for it to `eval/rag/queries.ts` and run `npm run eval:rag`.
6. `npm run verify-sheet` writes a checklist. A named person checks every rule against the official pages and runs `npm run promote-pack -- --pack <id> --by "Full Name" --evidence <link>`. A verified pack cannot contain unconfirmed rules.

## A new country
Same steps, with a new `--country` code. Also translate the interface text in `public/app.js` (one block per language) and add stop words for the language in `src/rag/tokenize.ts`. Retrieval works on any script that has words separated by spaces.

## Many documents (bylaws, circulars, FAQs)
1. Save them as `.txt` or `.md` files in one folder. A first line starting with `# ` becomes the title.
2. `npm run ingest -- ./my-folder --label "Dhaka North bylaws" --url https://source --status official`
3. Restart the server. Each document is split into overlapping passages of about 120 words, each linked to its source. They are searched and cited like everything else.

PDFs are not read directly. Convert them to text first. Passages are searched by word, so a document in a language with a different script also needs that language's stop words.

## Adding a good evaluation
Write 20 real questions people ask, in their own words. Keep half back and never tune against them. That gives an honest number, as this project's held-out set does.
