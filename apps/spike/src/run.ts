import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Manifest, type LedgerEntry } from '@facelab/contracts';

export const ROOT = resolve(import.meta.dirname, '../../..');
export const RUNS = join(ROOT, 'runs');

export class BudgetExceeded extends Error {}

export class Run {
  constructor(public dir: string, public m: Manifest) {}

  static create(m: Omit<Manifest, 'scenes' | 'ledger'>): Run {
    const dir = join(RUNS, m.id);
    mkdirSync(join(dir, 'assets'), { recursive: true });
    const run = new Run(dir, Manifest.parse(m));
    run.save();
    return run;
  }
  static load(idOrDir: string): Run {
    const dir = existsSync(join(idOrDir, 'manifest.json')) ? resolve(idOrDir) : join(RUNS, idOrDir);
    return new Run(dir, Manifest.parse(JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))));
  }
  save() { writeFileSync(join(this.dir, 'manifest.json'), JSON.stringify(this.m, null, 2)); }
  asset(name: string) { return join(this.dir, 'assets', name); }
  write(name: string, bytes: Buffer) { writeFileSync(this.asset(name), bytes); return name; }

  get spent() { return this.m.ledger.reduce((n, e) => n + e.usd, 0); }
  get ceiling() { return Number(process.env.MAX_RUN_USD ?? 5); }

  /** Call before any paid request. Stops the run instead of crossing the ceiling. */
  guard(nextUsd: number, step: string) {
    if (this.spent + nextUsd > this.ceiling) {
      throw new BudgetExceeded(`Stopping before "${step}": it would take this run to $${(this.spent + nextUsd).toFixed(2)}, above the $${this.ceiling.toFixed(2)} ceiling (MAX_RUN_USD).`);
    }
  }
  charge(e: Omit<LedgerEntry, 'at'>) {
    this.m.ledger.push({ ...e, at: new Date().toISOString() });
    this.save();
  }
}
