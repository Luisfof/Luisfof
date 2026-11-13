// Senhas, sessões, CSRF, cabeçalhos e limitadores de requisição.
import { randomBytes, scrypt, scryptSync, timingSafeEqual, createHash, randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import type { User, UserRole } from '../shared/types.ts';
import type { Db } from './db.ts';
import { nowIso } from './db.ts';
import type { AppOptions, RateLimitName } from './config.ts';

declare module 'express-serve-static-core' {
  interface Request {
    user?: User;
    sessionHash?: string;
  }
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

// ---------- Senhas (scrypt + salt por usuário) ----------
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function encodeHash(salt: Buffer, key: Buffer): string {
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) =>
      err ? reject(err) : resolve(encodeHash(salt, key)),
    );
  });
}

export function hashPasswordSync(password: string): string {
  const salt = randomBytes(16);
  return encodeHash(salt, scryptSync(password.normalize('NFKC'), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }));
}

function parseHash(stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return null;
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![N, r, p].every((n) => Number.isInteger(n) && n > 0) || N > 2 ** 17) return null;
  return { N, r, p, salt: Buffer.from(parts[4], 'base64'), key: Buffer.from(parts[5], 'base64') };
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  const h = parseHash(stored);
  if (!h || h.key.length === 0) return Promise.resolve(false);
  return new Promise((resolve) => {
    scrypt(password.normalize('NFKC'), h.salt, h.key.length, { N: h.N, r: h.r, p: h.p }, (err, key) => {
      if (err) return resolve(false);
      resolve(key.length === h.key.length && timingSafeEqual(key, h.key));
    });
  });
}

export function verifyPasswordSync(password: string, stored: string): boolean {
  const h = parseHash(stored);
  if (!h || h.key.length === 0) return false;
  const key = scryptSync(password.normalize('NFKC'), h.salt, h.key.length, { N: h.N, r: h.r, p: h.p });
  return key.length === h.key.length && timingSafeEqual(key, h.key);
}

/** Hash usado para igualar o tempo de resposta quando o e-mail não existe. */
export const DUMMY_HASH = hashPasswordSync(randomBytes(24).toString('hex'));

// ---------- Sessões ----------
export const SESSION_COOKIE = 'moraa_sid';
const SESSION_MS = 14 * 24 * 60 * 60 * 1000;

export const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header || header.length > 8192) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    let v = part.slice(i + 1).trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!(k in out)) {
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    }
  }
  return out;
}

function cookieAttrs(req: Request, isProd: boolean): string {
  const secure = isProd || req.secure;
  return `Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}

export function createSession(db: Db, req: Request, res: Response, userId: string, isProd: boolean): void {
  // Rotação: invalida a sessão apresentada (se houver) e emite um token novo.
  const old = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (old) db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(old));
  db.run('DELETE FROM sessions WHERE expires_at < ?', nowIso());
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_MS);
  db.run('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?,?,?,?)', sha256(token), userId, nowIso(), expires.toISOString());
  res.append('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieAttrs(req, isProd)}; Max-Age=${SESSION_MS / 1000}; Expires=${expires.toUTCString()}`);
}

export function destroySession(db: Db, req: Request, res: Response, isProd: boolean): void {
  const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (token) db.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  res.append('Set-Cookie', `${SESSION_COOKIE}=; ${cookieAttrs(req, isProd)}; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
}

interface SessionRow {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  expires_at: string;
}

/** Anexa req.user quando o cookie de sessão é válido. Nunca falha. */
export function attachUser(db: Db): RequestHandler {
  return (req, _res, next) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token && token.length <= 128) {
      const hash = sha256(token);
      const row = db.get<SessionRow>(
        'SELECT u.id, u.name, u.email, u.role, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?',
        hash,
      );
      if (row && row.expires_at > nowIso()) {
        req.user = { id: row.id, name: row.name, email: row.email, role: row.role };
        req.sessionHash = hash;
      }
    }
    next();
  };
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Faça login para continuar.'));
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(new HttpError(401, 'Faça login para continuar.'));
  if (req.user.role !== 'admin') return next(new HttpError(403, 'Acesso restrito à administração.'));
  next();
};

/** CSRF: toda requisição de escrita em /api precisa do cabeçalho X-Requested-With: moraa. */
export const csrfGuard: RequestHandler = (req, _res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (req.get('x-requested-with') !== 'moraa') {
    return next(new HttpError(403, 'Requisição bloqueada por segurança. Atualize a página e tente novamente.'));
  }
  next();
};

// ---------- Cabeçalhos ----------
export function securityHeaders(isProd: boolean): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(isProd ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    strictTransportSecurity: isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    crossOriginEmbedderPolicy: false,
  });
}

export const permissionsPolicy: RequestHandler = (_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  next();
};

// ---------- Limitadores ----------
const noop: RequestHandler = (_req, _res, next) => next();

export type Limiters = Record<RateLimitName, RequestHandler>;

export function makeLimiters(opts: Pick<AppOptions, 'rateLimits' | 'rateLimitMax'>): Limiters {
  const names: RateLimitName[] = ['global', 'login', 'register', 'contact', 'report', 'upload', 'planInterest', 'write'];
  if (opts.rateLimits === false) return Object.fromEntries(names.map((n) => [n, noop])) as Limiters;

  const make = (name: RateLimitName, windowMs: number, max: number, message: string, extra: Parameters<typeof rateLimit>[0] = {}) =>
    rateLimit({
      windowMs,
      limit: opts.rateLimitMax?.[name] ?? max,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req: Request, res: Response) => {
        res.status(429).json({ error: message });
      },
      ...extra,
    });

  const MIN = 60_000;
  const HOUR = 60 * MIN;
  return {
    global: make('global', MIN, 300, 'Muitas requisições. Aguarde um instante e tente novamente.'),
    login: make('login', 15 * MIN, 10, 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.', {
      skipSuccessfulRequests: true,
      keyGenerator: (req: Request) => {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
        return `${ipKeyGenerator(req.ip ?? '')}|${email}`;
      },
    }),
    register: make('register', HOUR, 10, 'Muitos cadastros a partir deste endereço. Tente novamente mais tarde.'),
    contact: make('contact', HOUR, 20, 'Você solicitou muitos contatos em pouco tempo. Tente novamente mais tarde.'),
    report: make('report', HOUR, 8, 'Você enviou muitas denúncias em pouco tempo. Tente novamente mais tarde.'),
    upload: make('upload', HOUR, 60, 'Muitos envios de imagens. Tente novamente mais tarde.'),
    planInterest: make('planInterest', HOUR, 20, 'Muitas requisições. Tente novamente mais tarde.'),
    write: make('write', HOUR, 120, 'Muitas alterações em pouco tempo. Tente novamente mais tarde.'),
  };
}

export const newId = () => randomUUID();

export function audit(db: Db, adminId: string, action: string, targetType: string, targetId: string, detail?: string | null): void {
  db.run(
    'INSERT INTO audit_log (admin_id, action, target_type, target_id, detail, created_at) VALUES (?,?,?,?,?,?)',
    adminId, action, targetType, targetId, detail ?? null, nowIso(),
  );
}

export type { NextFunction };
