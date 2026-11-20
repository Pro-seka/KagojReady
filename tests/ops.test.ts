import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { parsePack } from '../src/pack/load';
import { PackSchema } from '../src/pack/schema';
import { scaffoldPack } from '../src/pack/scaffold';
import { validatePackSet } from '../src/pack/set';
import { buildKb, Retriever } from '../src/kb/load';
import { runRagLive } from '../src/ops/rag-live';
import { DEV, DEV_OUT } from '../eval/rag/queries';

const packs = readdirSync('tests/fixtures/packs').map((f) => parsePack(JSON.parse(readFileSync(`tests/fixtures/packs/${f}`, 'utf8'))));
const retriever = new Retriever(buildKb(packs)); const services = packs.map((p) => ({ id: p.pack_id }));
const inScope = DEV.map((x) => x.q);

describe('grounded-answer evaluation (run with a fake model; the live run needs a key)', () => {
  it('a model that follows the rules passes every in-scope question, and no out-of-scope question is answered', async () => {
    const r = await runRagLive({ llm: { complete: async () => 'The sources cover this [1].' }, retriever, services, inScope, outOfScope: DEV_OUT });
    expect(r.modes.grounded).toBe(r.inScope - r.inScopeRefused - r.modes.action); expect(r.groundedRate).toBe(1); expect(r.outOfScopeAnswered).toBe(0); expect(r.questionsWithNumbersHidden).toBe(0);
  });
  it('catches a model that ignores citations, and one that invents numbers, counting why each was rejected', async () => {
    const noCite = await runRagLive({ llm: { complete: async () => 'Just bring everything.' }, retriever, services, inScope, outOfScope: DEV_OUT });
    expect(noCite.groundedRate).toBe(0); expect(noCite.rejected.no_citation).toBeGreaterThan(10);
    const invents = await runRagLive({ llm: { complete: async () => 'It costs 9999 taka [1].' }, retriever, services, inScope, outOfScope: DEV_OUT });
    expect(invents.groundedRate).toBe(0); expect(invents.rejected.ungrounded_number).toBeGreaterThan(10);
  });
  it('counts model outages, and still refuses out-of-scope questions without calling the model', async () => {
    let calls = 0; const down = { complete: async () => { calls++; throw new Error('503'); } };
    const r = await runRagLive({ llm: down, retriever, services, inScope: [], outOfScope: DEV_OUT });
    expect(calls).toBe(0); expect(r.outOfScopeAnswered).toBe(0);
    const r2 = await runRagLive({ llm: down, retriever, services, inScope: inScope.slice(0, 3), outOfScope: [] }); expect(r2.llmFailures).toBe(3); expect(r2.modes.extractive).toBe(3);
  });
});

describe('adding a service or country is data, not code', () => {
  const sk = scaffoldPack({ id: 'bd-birth-registration', nameEn: 'Birth registration', nameBn: 'জন্মনিবন্ধন', country: 'bd', order: 3 });
  it('the scaffold is a valid draft pack that cannot be mistaken for a finished one', () => {
    const p = PackSchema.parse(sk); expect(p).toMatchObject({ status: 'DRAFT_UNVERIFIED', country: 'BD', display_order: 3, verified_by: null });
    expect(JSON.stringify(sk)).toMatch(/TODO/); expect(p.rules.every((r) => r.rule_status === 'unconfirmed' && r.severity !== 'blocker')).toBe(true);
  });
  it('once placed in the pack folder it joins the knowledge base and the service list with no code change', () => {
    const all = [...packs, PackSchema.parse(sk)]; expect(validatePackSet(all)).toEqual([]);
    const kb = buildKb(all); expect(kb.some((c) => c.id === 'bd-birth-registration:overview')).toBe(true); expect(kb.some((c) => c.id === 'bd-birth-registration:XX-001')).toBe(true);
    expect(new Retriever(kb).retrieve('birth registration', 2).length).toBeGreaterThan(0);
  });
  it('drafts in packs/drafts are never loaded by the server', () => {
    expect(readdirSync('packs').filter((f) => f.endsWith('.json')).every((f) => !f.includes('TODO'))); expect(existsSync('packs/drafts')).toBe(true);
    expect(readdirSync('packs').filter((f) => f.endsWith('.json')).length).toBe(2);
  });
});

import { makeDemoLlm } from '../src/server/demo';
import { runCheck } from '../src/pipeline';
import { dataUrl, JPEG } from './helpers';
describe('demo mode is predictable for a live demo', () => {
  it('alternates between "matching documents" and "date of birth mismatch", and never reads the photo', async () => {
    const llm = makeDemoLlm(); const pack = packs.find((p) => p.pack_id === 'bd-passport-adult-renewal')!;
    const verdicts: string[] = [];
    for (let i = 0; i < 4; i++) verdicts.push((await runCheck({ pack, applicantType: 'adult', images: { nid: dataUrl(JPEG), old_passport: dataUrl(Buffer.concat([JPEG, Buffer.alloc(i * 7)])) }, llm, today: '2026-10-22' })).report.verdict);
    expect(verdicts).toEqual(['READY', 'NOT_READY', 'READY', 'NOT_READY']);
  });
});
