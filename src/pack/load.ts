import { readFileSync } from 'node:fs';
import { PackSchema, type Pack } from './schema';

export function parsePack(json: unknown): Pack {
  return PackSchema.parse(json);
}
export function loadPack(path: string): Pack {
  return parsePack(JSON.parse(readFileSync(path, 'utf8')));
}
