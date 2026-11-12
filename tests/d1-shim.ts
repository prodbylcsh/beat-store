import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';

/** Minimální náhrada D1 nad vestavěným SQLite v Node – stačí na testy logiky objednávek. */
export function createD1(): D1Database {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync('migrations/0001_initial.sql', 'utf8'));
  const conv = (sql: string) => sql.replace(/\?(\d+)/g, '?$1');
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const stmt = {
      bind(...a: unknown[]) { args = a.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v)); return stmt; },
      async first<T>() { return (db.prepare(conv(sql)).get(...(args as never[])) ?? null) as T | null; },
      async all<T>() { return { results: db.prepare(conv(sql)).all(...(args as never[])) as T[] }; },
      async run() { db.prepare(conv(sql)).run(...(args as never[])); return { success: true }; },
    };
    return stmt;
  };
  return {
    prepare,
    async batch(stmts: { run(): Promise<unknown> }[]) { for (const s of stmts) await s.run(); return []; },
  } as unknown as D1Database;
}
