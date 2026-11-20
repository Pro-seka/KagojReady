import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadDotEnv, parseDotEnv } from '../src/config/env';

describe('.env parsing', () => {
  it('handles comments, quotes, export, spaces, CRLF and a BOM', () => {
    const t = '\uFEFF# comment\r\nGEMINI_API_KEY = abc123 \r\nexport PORT=3000\r\nQ1="has # hash"\r\nQ2=\'single\'\r\nINLINE=value # trailing comment\r\nEMPTY=\r\nnot a line\r\n';
    expect(parseDotEnv(t)).toEqual({ GEMINI_API_KEY: 'abc123', PORT: '3000', Q1: 'has # hash', Q2: 'single', INLINE: 'value', EMPTY: '' });
  });
});
describe('loadDotEnv', () => {
  const file = (body: string) => { const p = join(mkdtempSync(join(tmpdir(), 'kr-env-')), '.env'); writeFileSync(p, body); return p; };
  it('fills in missing and empty variables but never overrides ones already set', () => {
    const env: NodeJS.ProcessEnv = { KEEP: 'real', BLANK: '' };
    expect(loadDotEnv(env, file('KEEP=from-file\nBLANK=filled\nNEW=1'))).toBe(true);
    expect(env).toMatchObject({ KEEP: 'real', BLANK: 'filled', NEW: '1' });
  });
  it('does nothing when the file is missing or loading is switched off', () => {
    const env: NodeJS.ProcessEnv = {};
    expect(loadDotEnv(env, '/no/such/.env')).toBe(false);
    expect(loadDotEnv({ KAGOJREADY_ENV_FILE: 'none' } as NodeJS.ProcessEnv)).toBe(false);
    const e2: NodeJS.ProcessEnv = { KAGOJREADY_ENV_FILE: 'none' }; loadDotEnv(e2, undefined); expect(Object.keys(e2)).toEqual(['KAGOJREADY_ENV_FILE']);
  });
});
