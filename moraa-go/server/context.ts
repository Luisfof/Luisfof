import type { Db } from './db.ts';
import type { Limiters } from './security.ts';

export interface Ctx {
  db: Db;
  isProd: boolean;
  uploadsDir: string;
  publicUrl: string;
  limiters: Limiters;
}
