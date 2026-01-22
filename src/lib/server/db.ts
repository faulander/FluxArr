import Database from 'better-sqlite3';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { env } from '$env/dynamic/private';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Database path from env or default
const DB_PATH = env.DATABASE_PATH || './data/fluxarr.db';

// Singleton database instance
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 5000');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// Run migrations
export function migrate(): void {
  const database = getDb();

  // Ensure schema_migrations table exists
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Get applied migrations
  const applied = new Set(
    database
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => (row as { version: number }).version)
  );

  // Read migration files
  const migrationsDir = join(__dirname, 'migrations');
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10);
    if (applied.has(version)) continue;

    console.log(`Applying migration ${file}...`);
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');

    database.transaction(() => {
      database.exec(sql);
      database.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(version);
    })();

    console.log(`Migration ${file} applied.`);
  }
}

// Helper types
export type Row = Record<string, unknown>;

// Query helpers
export const query = {
  all<T = Row>(sql: string, params: unknown[] = []): T[] {
    return getDb().prepare(sql).all(...params) as T[];
  },

  get<T = Row>(sql: string, params: unknown[] = []): T | undefined {
    return getDb().prepare(sql).get(...params) as T | undefined;
  },

  run(sql: string, params: unknown[] = []): Database.RunResult {
    return getDb().prepare(sql).run(...params);
  },

  exec(sql: string): void {
    getDb().exec(sql);
  },

  transaction<T>(fn: () => T): T {
    return getDb().transaction(fn)();
  }
};
