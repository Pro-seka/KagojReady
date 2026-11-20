import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePack } from '../src/pack/load';
import { promotePack } from '../src/pack/promote';

const DRAFTS = 'tests/fixtures/packs';   // frozen drafts: independent of the real packs
const verifiedDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'kr-verified-'));
  for (const f of readdirSync(DRAFTS)) {
    const p = parsePack(JSON.parse(readFileSync(join(DRAFTS, f), 'utf8'))); p.rules = p.rules.map((r) => ({ ...r, rule_status: r.rule_status === 'unconfirmed' ? 'operator_reported' as const : r.rule_status }));
    writeFileSync(join(dir, f), JSON.stringify(promotePack(p, { by: 'A. Verifier', evidenceUrl: 'https://example.org/p', today: '2026-10-20' })));
  }
  return dir;
};

// KAGOJREADY_ENV_FILE=none stops these tests from reading the developer's real .env, which could hold a live key.
function boot(env: Record<string, string>, port: number): Promise<{ code: number | null; out: string; kill: () => void; port: number }> {
  return new Promise((resolve) => {
    const p = spawn('npx', ['tsx', 'src/server/index.ts'], { detached: true, env: { PATH: process.env.PATH!, HOME: process.env.HOME ?? '', PORT: String(port), KAGOJREADY_PACKS_DIR: DRAFTS, KAGOJREADY_ENV_FILE: 'none', ...env } });
    const killGroup = () => { try { process.kill(-p.pid!, 'SIGKILL'); } catch { /* already gone */ } };
    let out = ''; let done = false;
    const finish = (code: number | null) => { if (!done) { done = true; if (code === -999) killGroup(); resolve({ code, out, kill: killGroup, port }); } };
    p.stdout.on('data', (d) => { out += d; if (/KagojReady on/.test(out)) finish(null); });
    p.stderr.on('data', (d) => { out += d; });
    p.on('exit', (c) => finish(c));
    setTimeout(() => finish(-999), 20_000);
  });
}

describe('production start-up guards (real server processes)', () => {
  it('refuses to start in production without an API key', async () => {
    const r = await boot({ NODE_ENV: 'production' }, 3201);
    expect(r.code).toBe(1); expect(r.out).toMatch(/no AI provider key is set/);
  }, 25_000);
  it('refuses demo mode in production', async () => {
    const r = await boot({ NODE_ENV: 'production', LLM_MODE: 'demo', ANTHROPIC_API_KEY: 'sk-fake' }, 3202);
    expect(r.code).toBe(1); expect(r.out).toMatch(/demo mode is not allowed in production/);
  }, 25_000);
  it('refuses to serve unverified packs in production unless explicitly allowed', async () => {
    const r = await boot({ NODE_ENV: 'production', ANTHROPIC_API_KEY: 'sk-fake' }, 3203);
    expect(r.code).toBe(1); expect(r.out).toMatch(/no VERIFIED packs/);
  }, 25_000);
  it('with the explicit pilot override it starts, and the services still report DRAFT so the UI shows the banner', async () => {
    const r = await boot({ NODE_ENV: 'production', ANTHROPIC_API_KEY: 'sk-fake', ALLOW_DRAFT_PACKS: '1' }, 3204);
    try {
      expect(r.code).toBeNull(); expect(r.out).toMatch(/live extraction via anthropic/);
      const d = await (await fetch(`http://127.0.0.1:${r.port}/api/services`)).json();
      expect(d.demo).toBe(false); expect(d.services.every((s: any) => s.status === 'DRAFT_UNVERIFIED')).toBe(true);
    } finally { r.kill(); }
  }, 25_000);
  it('outside production, demo mode starts and says so', async () => {
    const r = await boot({ LLM_MODE: 'demo' }, 3205);
    try {
      expect(r.out).toMatch(/DEMO MODE/);
      expect((await (await fetch(`http://127.0.0.1:${r.port}/api/services`)).json()).demo).toBe(true);
    } finally { r.kill(); }
  }, 25_000);
  it('with VERIFIED packs it starts in production with no override, and the services report VERIFIED', async () => {
    const r = await boot({ NODE_ENV: 'production', ANTHROPIC_API_KEY: 'sk-fake', KAGOJREADY_PACKS_DIR: verifiedDir() }, 3206);
    try {
      expect(r.code).toBeNull();
      const d = await (await fetch(`http://127.0.0.1:${r.port}/api/services`)).json();
      expect(d.services.length).toBe(2); expect(d.services.every((s: any) => s.status === 'VERIFIED' && s.lastVerified === '2026-10-20')).toBe(true);
    } finally { r.kill(); }
  }, 25_000);
  it('refuses to run in production on the Gemini free tier, and says how to fix it', async () => {
    const r = await boot({ NODE_ENV: 'production', LLM_PROVIDER: 'gemini', GEMINI_API_KEY: 'g-fake', ALLOW_DRAFT_PACKS: '1' }, 3207);
    expect(r.code).toBe(1); expect(r.out).toMatch(/free tier.*improve its products.*GEMINI_TIER=paid/s);
    const d = await boot({ NODE_ENV: 'production', GEMINI_API_KEY: 'g-fake', ALLOW_DRAFT_PACKS: '1' }, 3208);   // free is the default, so an unset tier is refused too
    expect(d.code).toBe(1);
  }, 40_000);
  it('allows Gemini in production once it is declared paid, and reports provider and tier without the key', async () => {
    const r = await boot({ NODE_ENV: 'production', GEMINI_API_KEY: 'g-SECRET-fake', GEMINI_TIER: 'paid', ALLOW_DRAFT_PACKS: '1' }, 3209);
    try {
      expect(r.code).toBeNull(); expect(r.out).toMatch(/live extraction via gemini/); expect(r.out).not.toMatch(/SECRET/);
      const d = await (await fetch(`http://127.0.0.1:${r.port}/api/services`)).json();
      expect(d.llm).toEqual({ provider: 'gemini', tier: 'paid' }); expect(JSON.stringify(d)).not.toMatch(/SECRET|g-fake/);
    } finally { r.kill(); }
  }, 25_000);
  it('on a developer machine Gemini free tier starts, and the UI is told it is free', async () => {
    const r = await boot({ GEMINI_API_KEY: 'g-fake' }, 3210);
    try {
      expect(r.code).toBeNull(); expect(r.out).toMatch(/gemini.*free tier/);
      expect((await (await fetch(`http://127.0.0.1:${r.port}/api/services`)).json()).llm).toEqual({ provider: 'gemini', tier: 'free' });
    } finally { r.kill(); }
  }, 25_000);
  it('one line switches provider: LLM_PROVIDER=anthropic uses Claude even when a Gemini key is present', async () => {
    const r = await boot({ GEMINI_API_KEY: 'g-fake', ANTHROPIC_API_KEY: 'a-fake', LLM_PROVIDER: 'anthropic' }, 3211);
    try { expect(r.code).toBeNull(); expect(r.out).toMatch(/via anthropic/); } finally { r.kill(); }
  }, 25_000);
  it('a provider named without its key fails with a plain message', async () => {
    const r = await boot({ LLM_PROVIDER: 'gemini' }, 3212);
    expect(r.code).toBe(1); expect(r.out).toMatch(/GEMINI_API_KEY is not set.*aistudio/s);
  }, 25_000);
  it('with no key at all it still starts and explains how to get one', async () => {
    const r = await boot({}, 3213);
    try { expect(r.code).toBeNull(); expect(r.out).toMatch(/aistudio\.google\.com\/apikey/); expect(r.out).toMatch(/no AI key/); } finally { r.kill(); }
  }, 25_000);
});
