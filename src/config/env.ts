import { existsSync, readFileSync } from 'node:fs';

/** Parses KEY=VALUE lines (comments, quotes, `export`, CRLF). Never logs values. */
export function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const raw of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    const q = v[0];
    if ((q === '"' || q === "'") && v.lastIndexOf(q) > 0) v = v.slice(1, v.lastIndexOf(q));
    else v = v.replace(/\s+#.*$/, '').trim();
    out[m[1]] = v;
  }
  return out;
}

/** Loads .env into `env` without overriding anything already set. Set KAGOJREADY_ENV_FILE=none to skip (used by tests). */
export function loadDotEnv(env: NodeJS.ProcessEnv = process.env, path = env.KAGOJREADY_ENV_FILE ?? '.env'): boolean {
  if (path === 'none' || !existsSync(path)) return false;
  for (const [k, v] of Object.entries(parseDotEnv(readFileSync(path, 'utf8')))) if (env[k] === undefined || env[k] === '') env[k] = v;
  return true;
}
