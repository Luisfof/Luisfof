// Monta o aplicativo Express. Cada chamada cria uma instância isolada (banco, limitadores, uploads).
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { ErrorRequestHandler, Express } from 'express';
import compression from 'compression';
import multer from 'multer';
import type { ApiError } from '../shared/types.ts';
import { ConfigError } from './config.ts';
import type { AppOptions } from './config.ts';
import type { Ctx } from './context.ts';
import { Db, nowIso } from './db.ts';
import {
  HttpError, attachUser, csrfGuard, hashPasswordSync, makeLimiters, newId, permissionsPolicy, securityHeaders, verifyPasswordSync,
} from './security.ts';
import { MAX_IMAGES } from './images.ts';
import { seedDemo } from './seed.ts';
import { mountStatic } from './static.ts';
import { authRoutes } from './routes/auth.ts';
import { publicRoutes } from './routes/public.ts';
import { myRoutes } from './routes/my.ts';
import { adminRoutes } from './routes/admin.ts';

/** Garante a conta administrativa configurada por ambiente (cria ou sincroniza a senha). */
function ensureAdmin(db: Db, email: string, password: string): void {
  const row = db.get<{ id: string; role: string; password_hash: string }>('SELECT id, role, password_hash FROM users WHERE email = ?', email);
  if (!row) {
    db.run(
      "INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?,?,?,?,'admin',?)",
      newId(), 'Administração MORAA GO', email, hashPasswordSync(password), nowIso(),
    );
    return;
  }
  if (row.role !== 'admin') db.run("UPDATE users SET role = 'admin' WHERE id = ?", row.id);
  if (!verifyPasswordSync(password, row.password_hash)) {
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPasswordSync(password), row.id);
    db.run('DELETE FROM sessions WHERE user_id = ?', row.id);
  }
}

export function createApp(opts: AppOptions): Express {
  const isProd = (opts.nodeEnv ?? 'development') === 'production';
  if (isProd && (!opts.adminPassword || opts.adminPassword.length < 12)) {
    throw new ConfigError('Em produção, defina ADMIN_PASSWORD com pelo menos 12 caracteres.');
  }

  const dataDir = path.resolve(opts.dataDir);
  const uploadsDir = path.join(dataDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  const db = new Db(opts.dbPath ?? path.join(dataDir, 'moraa.sqlite'));
  db.run('DELETE FROM sessions WHERE expires_at < ?', nowIso());
  if (opts.adminEmail && opts.adminPassword) ensureAdmin(db, opts.adminEmail.trim().toLowerCase(), opts.adminPassword);
  if (opts.seedDemo !== false) seedDemo(db);

  const ctx: Ctx = {
    db,
    isProd,
    uploadsDir,
    publicUrl: (opts.publicUrl ?? 'http://localhost:8787').replace(/\/+$/, ''),
    limiters: makeLimiters(opts),
  };

  const app = express();
  app.locals.ctx = ctx;
  app.disable('x-powered-by');
  app.set('etag', 'weak');
  if (opts.trustProxy) app.set('trust proxy', 1);

  app.use(securityHeaders(isProd));
  app.use(permissionsPolicy);
  app.use(compression());

  // ---------- API ----------
  const api = express.Router();
  api.use(ctx.limiters.global);
  api.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  api.use(csrfGuard);
  api.use(express.json({ limit: '100kb', strict: true }));
  api.use(attachUser(db));
  api.use('/auth', authRoutes(ctx));
  api.use('/my', myRoutes(ctx));
  api.use('/admin', adminRoutes(ctx));
  api.use(publicRoutes(ctx));
  api.use((_req, _res, next) => next(new HttpError(404, 'Rota não encontrada.')));
  app.use('/api', api);

  // ---------- Arquivos, SPA, SEO ----------
  mountStatic(app, ctx, opts.distDir ?? path.resolve('dist'));
  app.use((_req, _res, next) => next(new HttpError(404, 'Página não encontrada.')));

  // ---------- Erros (sempre no formato ApiError, em pt-BR) ----------
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    let status = 500;
    let body: ApiError = { error: 'Erro interno. Tente novamente em instantes.' };
    if (err instanceof HttpError) {
      status = err.status;
      body = { error: err.message, ...(err.fields ? { fields: err.fields } : {}) };
    } else if (err instanceof multer.MulterError) {
      status = 400;
      body = {
        error:
          err.code === 'LIMIT_FILE_SIZE' ? 'Cada foto pode ter no máximo 6 MB.'
          : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? `Envie até ${MAX_IMAGES} fotos no campo "images".`
          : 'Envio de imagens inválido.',
      };
    } else if (err?.type === 'entity.too.large') {
      status = 413;
      body = { error: 'Requisição grande demais.' };
    } else if (err?.type === 'entity.parse.failed' || err?.type === 'charset.unsupported' || err?.type === 'encoding.unsupported') {
      status = 400;
      body = { error: 'Não foi possível ler os dados enviados (JSON inválido).' };
    } else if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
      status = err.status;
      body = { error: status === 404 ? 'Não encontrado.' : 'Requisição inválida.' };
    } else {
      // Loga apenas nome/mensagem/stack do erro — nunca corpo, cookies ou cabeçalhos.
      console.error('[moraa] erro interno:', err instanceof Error ? (err.stack ?? err.message) : 'erro desconhecido');
    }
    if (res.headersSent) return void res.end();
    res.status(status).json(body);
  };
  app.use(onError);

  return app;
}

export const getCtx = (app: Express): Ctx => app.locals.ctx as Ctx;
