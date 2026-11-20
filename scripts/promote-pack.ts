import { readFileSync, writeFileSync } from 'node:fs';
import { parsePack } from '../src/pack/load';
import { promotePack } from '../src/pack/promote';

const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : undefined; };
const id = arg('pack'), by = arg('by'), evidence = arg('evidence');
if (!id || !by || !evidence) { console.error('Usage: npm run promote-pack -- --pack <pack_id> --by "Full Name" --evidence <https url> [--days 90]'); process.exit(2); }
const file = `packs/${id}.json`;
try {
  const pack = promotePack(parsePack(JSON.parse(readFileSync(file, 'utf8'))), { by, evidenceUrl: evidence, today: new Date().toISOString().slice(0, 10), days: arg('days') ? Number(arg('days')) : 90 });
  writeFileSync(file, JSON.stringify(pack, null, 2) + '\n');
  console.log(`${id} is now VERIFIED by ${by}. Review again by ${pack.review_by}.`);
} catch (e) { console.error(`Not promoted. Fix these first:\n${(e as Error).message}`); process.exit(1); }
