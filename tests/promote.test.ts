import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePack } from '../src/pack/load';
import { promotePack } from '../src/pack/promote';

const draft = () => parsePack(JSON.parse(readFileSync('tests/fixtures/packs/bd-passport-adult-renewal.json', 'utf8')));
const input = { by: 'A. Verifier', evidenceUrl: 'https://example.org/pages', today: '2026-10-20' };

describe('promotePack', () => {
  it('refuses to promote a draft that still has unconfirmed rules, and names them', () => {
    expect(() => promotePack(draft(), input)).toThrow(/RN-011.*unconfirmed/s);
  });
  it('promotes once every rule is confirmed or removed, and sets the review date 90 days out', () => {
    const p = draft(); p.rules = p.rules.filter((r) => r.rule_status !== 'unconfirmed');
    const v = promotePack(p, input);
    expect(v).toMatchObject({ status: 'VERIFIED', last_verified: '2026-10-20', review_by: '2027-01-18', verified_by: 'A. Verifier' });
  });
  it('respects a custom review period and refuses an empty verifier or bad link', () => {
    const p = draft(); p.rules = p.rules.filter((r) => r.rule_status !== 'unconfirmed');
    expect(promotePack(p, { ...input, days: 30 }).review_by).toBe('2026-11-19');
    expect(() => promotePack(p, { ...input, by: '' })).toThrow();
    expect(() => promotePack(p, { ...input, evidenceUrl: 'not a url' })).toThrow();
  });
  it('does not change the original draft', () => {
    const p = draft(); const before = JSON.stringify(p); try { promotePack(p, input); } catch { /* expected */ }
    expect(JSON.stringify(p)).toBe(before);
  });
});
