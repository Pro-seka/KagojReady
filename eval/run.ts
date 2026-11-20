import { loadPack } from '../src/pack/load';
import { buildReport } from '../src/report/verdict';
import { buildSubmission, CASES } from './cases';

const pack = loadPack('packs/bd-passport-adult-renewal.json');
let checks = 0, wrong = 0, falsePass = 0, falseReady = 0, verdictWrong = 0;
const failures: string[] = [];

for (const c of CASES) {
  const report = buildReport(pack, buildSubmission(c), { today: '2026-10-20' });
  for (const r of report.results) {
    const want = c.expect[r.ruleId] ?? 'PASS';
    checks++;
    if (r.outcome !== want) {
      wrong++;
      if (want !== 'PASS' && r.outcome === 'PASS') falsePass++;
      failures.push(`${c.name}: ${r.ruleId} expected ${want}, got ${r.outcome} (${r.reason})`);
    }
  }
  for (const id of Object.keys(c.expect)) if (!report.results.some((r) => r.ruleId === id)) {
    checks++; wrong++; failures.push(`${c.name}: expected rule ${id} is missing from the report`);
  }
  if (report.verdict !== c.verdict) {
    verdictWrong++;
    if (c.verdict !== 'READY' && report.verdict === 'READY') falseReady++;
    failures.push(`${c.name}: verdict expected ${c.verdict}, got ${report.verdict}`);
  }
}
console.log(`Decision-layer evaluation (structured inputs, no images)`);
console.log(`  cases:                 ${CASES.length}`);
console.log(`  rule-level checks:     ${checks}`);
console.log(`  rule mismatches:       ${wrong}`);
console.log(`  FALSE PASSES:          ${falsePass}   (rule should not pass, engine passed it)`);
console.log(`  verdict mismatches:    ${verdictWrong}`);
console.log(`  FALSE READY verdicts:  ${falseReady}`);
failures.forEach((x) => console.log(`  ! ${x}`));
process.exit(wrong + verdictWrong === 0 ? 0 : 1);
