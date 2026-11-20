import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Ticket } from './types';

/** Where tickets live. The interface is tiny on purpose: a pilot uses the file store, a real deployment swaps in a database without touching anything else. */
export interface TicketStore {
  get(id: string): Ticket | undefined;
  all(): Ticket[];
  save(t: Ticket): void;
  savePhoto(id: string, bytes: Buffer): string;
  readPhoto(name: string): Buffer | null;
  deletePhoto(name: string): void;
}

export class MemoryTicketStore implements TicketStore {
  protected tickets = new Map<string, Ticket>(); protected photos = new Map<string, Buffer>();
  get(id: string) { return this.tickets.get(id); }
  all() { return [...this.tickets.values()]; }
  save(t: Ticket) { this.tickets.set(t.id, structuredClone(t)); }
  savePhoto(id: string, bytes: Buffer) { const name = `${id}.jpg`; this.photos.set(name, bytes); return name; }
  readPhoto(name: string) { return this.photos.get(name) ?? null; }
  deletePhoto(name: string) { this.photos.delete(name); }
}

/** Append-only JSON lines plus one file per photo. The last line for a ticket wins, so history is never rewritten. Single instance only. */
export class FileTicketStore extends MemoryTicketStore {
  private log: string; private photoDir: string;
  constructor(dir: string) {
    super(); mkdirSync(join(dir, 'photos'), { recursive: true }); this.log = join(dir, 'tickets.jsonl'); this.photoDir = join(dir, 'photos');
    if (existsSync(this.log)) for (const line of readFileSync(this.log, 'utf8').split('\n')) { if (!line.trim()) continue; try { const t = JSON.parse(line) as Ticket; this.tickets.set(t.id, t); } catch { /* a torn last line after a crash is skipped */ } }
  }
  save(t: Ticket) { super.save(t); appendFileSync(this.log, `${JSON.stringify(t)}\n`, { mode: 0o600 }); }
  savePhoto(id: string, bytes: Buffer) { const name = `${id}.jpg`; writeFileSync(join(this.photoDir, name), bytes, { mode: 0o600 }); return name; }
  readPhoto(name: string) { if (!/^[A-Z0-9-]+\.jpg$/.test(name)) return null; const p = join(this.photoDir, name); return existsSync(p) ? readFileSync(p) : null; }
  deletePhoto(name: string) { if (!/^[A-Z0-9-]+\.jpg$/.test(name)) return; const p = join(this.photoDir, name); if (existsSync(p)) unlinkSync(p); }
}
