import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { parsePack } from '../src/pack/load';

const raw = () => JSON.parse(readFileSync('tests/fixtures/packs/bd-passport-adult-renewal.json', 'utf8'));   // frozen draft fixture, independent of the real pack's status
const mutate = (fn: (p: any) => void) => { const p = raw(); fn(p); return p; };

describe('pack schema', () => {
  it('every pack in /packs is valid', () => {
    for (const file of readdirSync('packs').filter((x) => x.endsWith('.json')))
      expect(() => parsePack(JSON.parse(readFileSync(`packs/${file}`, 'utf8')))).not.toThrow();
  });
  it('rejects an unconfirmed blocker', () =>
    expect(() => parsePack(mutate((p) => { p.rules[4].severity = 'blocker'; }))).toThrow(/unconfirmed/));
  it('rejects an official rule without a source', () =>
    expect(() => parsePack(mutate((p) => { delete p.rules[0].source_ref; }))).toThrow(/source_ref/));
  it('rejects duplicate rule ids', () =>
    expect(() => parsePack(mutate((p) => { p.rules[1].id = p.rules[0].id; }))).toThrow(/duplicate/));
  it('rejects unknown documents and fields', () => {
    expect(() => parsePack(mutate((p) => { p.rules[0].doc = 'ghost'; }))).toThrow(/unknown document/);
    expect(() => parsePack(mutate((p) => { p.rules[4].field = 'ghost'; }))).toThrow(/no field/);
  });
  it('rejects a VERIFIED pack with no verification date', () =>
    expect(() => parsePack(mutate((p) => { p.status = 'VERIFIED'; }))).toThrow(/last_verified/));
  it('rejects an invalid regex', () =>
    expect(() => parsePack(mutate((p) => { p.rules[5].pattern = '('; }))).toThrow(/regex/));
  it('a VERIFIED pack needs a named verifier, an evidence link, dates and no unconfirmed rules', () => {
    const verified = (fn: (p: any) => void) => mutate((p) => { p.status = 'VERIFIED'; p.last_verified = '2026-10-20'; p.review_by = '2027-01-18'; p.verified_by = 'A. Verifier'; p.evidence_url = 'https://example.org/pages'; p.rules = p.rules.filter((r: any) => r.rule_status !== 'unconfirmed'); fn(p); });
    expect(() => parsePack(verified(() => {}))).not.toThrow();
    expect(() => parsePack(verified((p) => { p.verified_by = null; }))).toThrow(/verified_by/);
    expect(() => parsePack(verified((p) => { p.evidence_url = null; }))).toThrow(/evidence_url/);
    expect(() => parsePack(verified((p) => { p.rules[0].rule_status = 'unconfirmed'; }))).toThrow(/cannot contain unconfirmed/);
  });
});
