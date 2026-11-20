import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodTypeAny, z } from 'zod';

export type Loaded<T> = { file: string; ok: true; data: T } | { file: string; ok: false; error: string };

export function loadFile<S extends ZodTypeAny>(path: string, schema: S): Loaded<z.infer<S>> | null {
  if (!existsSync(path)) return null;
  try {
    const r = schema.safeParse(JSON.parse(readFileSync(path, 'utf8')));
    return r.success ? { file: path, ok: true, data: r.data } : { file: path, ok: false, error: r.error.issues.map((i) => `${i.path.join('.') || 'file'}: ${i.message}`).join('; ').slice(0, 220) };
  } catch (e) { return { file: path, ok: false, error: `not valid JSON (${(e as Error).message.slice(0, 60)})` }; }
}
export function loadDir<S extends ZodTypeAny>(dir: string, schema: S): Array<Loaded<z.infer<S>>> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => loadFile(join(dir, f), schema)!);
}
