// Writes a one-page checklist per pack for the person who verifies the rules.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { parsePack } from '../src/pack/load';

mkdirSync('docs/rule-verification', { recursive: true });
for (const f of readdirSync('packs').filter((x) => x.endsWith('.json'))) {
  const p = parsePack(JSON.parse(readFileSync(`packs/${f}`, 'utf8')));
  const rows = p.rules.map((r) => {
    const src = r.source_ref !== undefined ? `[${r.source_ref + 1}]` : 'none';
    const look = r.type === 'field_match' ? `${r.field} on ${r.docs.join(' + ')} must match (${r.pass_levels.join('/')})`
      : r.type === 'required_document' ? `${r.doc} must be provided` : r.type === 'field_present' ? `${r.doc}.${r.field} must be present`
      : r.type === 'format_check' ? `${r.doc}.${r.field} matches ${r.pattern}` : `${r.doc}.${r.field}: ${r.check}${r.years ? ' ' + r.years : ''}`;
    return `| ${r.id} | ${r.severity} | ${r.rule_status} | ${look} | ${r.message_en.replace(/\|/g, '/')} | ${src} | | |`;
  });
  const md = `# Rule verification sheet: ${p.pack_id} v${p.version}

Status now: **${p.status}**. This sheet is for the named person who checks these rules. Nothing here is verified until you sign below.

## How to check
1. Open each source below on the **official domestic** page for this service. Save a dated copy (PDF or screenshot) in a folder the team can reach.
2. For every rule, decide one of: **official** (an official page says it), **operator_reported** (several operators confirm it, with interview notes), or **remove** (you cannot confirm it).
3. Edit \`rule_status\` (or delete the rule) in \`packs/${p.pack_id}.json\`. A VERIFIED pack cannot contain \`unconfirmed\` rules. A rule marked official needs a source.
4. Run: \`npm run promote-pack -- --pack ${p.pack_id} --by "Your Full Name" --evidence <link to the saved pages>\`

## Sources
${p.sources.map((s, i) => `${i + 1}. ${s.label}: ${s.url} (retrieved ${s.retrieved})`).join('\n')}

Note: sources written for applicants abroad (mission pages) may differ from domestic practice. Confirm each rule against the domestic process.

## Documents the app reads
${p.documents.map((d) => `- ${d.name_en}: ${d.fields.join(', ')}`).join('\n')}

## Rules
| Rule | Severity | Status now | What it checks | What the user sees | Source | Your decision | Notes |
|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## Sign-off
- Verified by (full name):
- Role and organisation:
- Date:
- Where the saved official pages are kept (link):
- Anything the app cannot check yet that you noticed:
`;
  writeFileSync(`docs/rule-verification/${p.pack_id}.md`, md);
  console.log(`wrote docs/rule-verification/${p.pack_id}.md (${p.rules.length} rules)`);
}
