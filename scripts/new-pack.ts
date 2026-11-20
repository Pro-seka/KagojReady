import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { scaffoldPack } from '../src/pack/scaffold';

const a = process.argv.slice(2); const opt = (n: string) => (a.includes(`--${n}`) ? a[a.indexOf(`--${n}`) + 1] : undefined);
const [id, en, bnName, country] = [opt('id'), opt('name-en'), opt('name-bn'), opt('country')];
if (!id || !en || !bnName || !country || !/^[a-z0-9-]{3,60}$/.test(id)) {
  console.error('Usage: npm run new-pack -- --id bd-birth-registration --name-en "Birth registration" --name-bn "জন্মনিবন্ধন" --country BD'); process.exit(2);
}
mkdirSync('packs/drafts', { recursive: true });
const path = `packs/drafts/${id}.json`;
if (existsSync(path) || existsSync(`packs/${id}.json`)) { console.error(`${id} already exists`); process.exit(1); }
writeFileSync(path, JSON.stringify(scaffoldPack({ id, nameEn: en, nameBn: bnName, country }), null, 2) + '\n');
console.log(`Created ${path}. It is NOT served yet. Replace every TODO, add sources and rules, then move it to packs/.\nNext: npm run verify-sheet, then a named person verifies it and runs npm run promote-pack.`);
