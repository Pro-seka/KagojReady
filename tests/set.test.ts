import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { parsePack } from '../src/pack/load';
import { validatePackSet } from '../src/pack/set';

const all = () => readdirSync('packs').filter((f) => f.endsWith('.json')).map((f) => parsePack(JSON.parse(readFileSync(`packs/${f}`, 'utf8'))));

describe('pack set integrity', () => {
  it('every fix_service link points at a real pack', () => expect(validatePackSet(all())).toEqual([]));
  it('detects a dangling link', () => {
    const passport = all().find((p) => p.pack_id === 'bd-passport-adult-renewal')!; const lone = [passport];
    expect(validatePackSet(lone).join()).toMatch(/does not exist/);
  });
  it('ships at least two packs, and every unconfirmed rule is at most a warning', () => {
    const packs = all(); expect(packs.length).toBeGreaterThanOrEqual(2);
    for (const p of packs) for (const r of p.rules) if (r.rule_status === 'unconfirmed') expect(r.severity).not.toBe('blocker');
  });
});
