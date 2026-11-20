// Adds documents to the knowledge base. Usage: npm run ingest -- <folder with .txt/.md files> --label "Source name" --url https://... [--status official] [--service pack-id]
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cardsFromDocument, slug } from '../src/kb/ingest';
import type { CardStatus } from '../src/kb/types';

const a = process.argv.slice(2); const dir = a.find((x) => !x.startsWith('--'));
const opt = (n: string) => (a.includes(`--${n}`) ? a[a.indexOf(`--${n}`) + 1] : undefined);
if (!dir || !opt('label') || !opt('url')) { console.error('Usage: npm run ingest -- <folder> --label "Source name" --url https://source [--status official|operator_reported|unconfirmed] [--service pack-id]'); process.exit(2); }
const status = (opt('status') ?? 'unconfirmed') as CardStatus;
if (!['official', 'operator_reported', 'unconfirmed'].includes(status)) { console.error('--status must be official, operator_reported or unconfirmed'); process.exit(2); }
const today = new Date().toISOString().slice(0, 10); mkdirSync('kb/ingested', { recursive: true });
let total = 0;
for (const f of readdirSync(dir).filter((x) => /\.(txt|md)$/i.test(x))) {
  const cards = cardsFromDocument(f, readFileSync(join(dir, f), 'utf8'), { source: { label: opt('label')!, url: opt('url')!, retrieved: today }, status, service: opt('service') ?? null });
  writeFileSync(`kb/ingested/${slug(f)}.json`, JSON.stringify(cards, null, 1)); total += cards.length; console.log(`${f}: ${cards.length} passages`);
}
console.log(`Ingested ${total} passages into kb/ingested/. Restart the server to use them.`);
