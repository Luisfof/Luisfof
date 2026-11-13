// Banco SQLite via node:sqlite (embutido no Node 22+; sem dependência nativa).
import type { DatabaseSync, StatementSync, SQLInputValue } from 'node:sqlite';

/** Carrega node:sqlite suprimindo apenas o ExperimentalWarning do próprio módulo. */
function loadSqlite(): typeof import('node:sqlite') {
  const original = process.emitWarning;
  process.emitWarning = ((warning: unknown, ...args: unknown[]) => {
    const text = typeof warning === 'string' ? warning : ((warning as Error)?.message ?? '');
    const first = args[0] as { type?: string } | string | undefined;
    const type = typeof warning === 'object' && warning ? (warning as Error).name : typeof first === 'string' ? first : first?.type;
    if (type === 'ExperimentalWarning' && /sqlite/i.test(text)) return;
    return (original as (...a: unknown[]) => void).call(process, warning, ...args);
  }) as typeof process.emitWarning;
  try {
    return process.getBuiltinModule('node:sqlite');
  } finally {
    process.emitWarning = original;
  }
}

const sqlite = loadSqlite();

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'anunciante' CHECK (role IN ('anunciante','admin')),
  terms_version TEXT,
  consent_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL,
  city TEXT NOT NULL,
  neighborhood TEXT NOT NULL,
  neighborhood_norm TEXT NOT NULL,
  search_text TEXT NOT NULL,
  price INTEGER NOT NULL,
  condo_fee INTEGER,
  iptu INTEGER,
  bedrooms INTEGER NOT NULL,
  bathrooms INTEGER NOT NULL,
  parking INTEGER NOT NULL,
  area_m2 REAL,
  features TEXT NOT NULL DEFAULT ',',
  is_demo INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','ativo','pausado','rejeitado')),
  approved INTEGER NOT NULL DEFAULT 0,
  paused_by TEXT,
  whatsapp TEXT,
  whatsapp_authorized INTEGER NOT NULL DEFAULT 0,
  ownership_declared_at TEXT,
  approx_lat REAL NOT NULL,
  approx_lng REAL NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  contact_clicks INTEGER NOT NULL DEFAULT 0,
  moderation_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status, featured, created_at);
CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  thumb_url TEXT NOT NULL,
  alt TEXT NOT NULL,
  position INTEGER NOT NULL,
  file TEXT,
  thumb_file TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_listing ON images(listing_id, position);
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','resolvida')),
  resolution TEXT,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS plan_interest (
  plan TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL
);
`;

type Params = SQLInputValue[];

/** Envoltório fino: somente SQL parametrizado, com cache de statements. */
export class Db {
  readonly raw: DatabaseSync;
  private cache = new Map<string, StatementSync>();

  constructor(file: string) {
    this.raw = new sqlite.DatabaseSync(file);
    this.raw.exec('PRAGMA foreign_keys = ON;');
    if (file !== ':memory:') this.raw.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;');
    this.raw.exec(SCHEMA);
  }

  private stmt(sql: string): StatementSync {
    let s = this.cache.get(sql);
    if (!s) {
      s = this.raw.prepare(sql);
      this.cache.set(sql, s);
    }
    return s;
  }

  get<T = Record<string, unknown>>(sql: string, ...params: Params): T | undefined {
    return this.stmt(sql).get(...params) as T | undefined;
  }

  all<T = Record<string, unknown>>(sql: string, ...params: Params): T[] {
    return this.stmt(sql).all(...params) as T[];
  }

  run(sql: string, ...params: Params): number {
    return Number(this.stmt(sql).run(...params).changes);
  }

  tx<T>(fn: () => T): T {
    this.raw.exec('BEGIN IMMEDIATE');
    try {
      const out = fn();
      this.raw.exec('COMMIT');
      return out;
    } catch (err) {
      this.raw.exec('ROLLBACK');
      throw err;
    }
  }

  close(): void {
    this.cache.clear();
    this.raw.close();
  }
}

export const nowIso = () => new Date().toISOString();
