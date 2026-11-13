import { Router } from 'express';
import type { User } from '../../shared/types.ts';
import type { Ctx } from '../context.ts';
import { nowIso } from '../db.ts';
import { TERMS_VERSION } from '../config.ts';
import { DUMMY_HASH, HttpError, createSession, destroySession, hashPassword, newId, requireAuth, verifyPassword } from '../security.ts';
import { loginSchema, parseBody, registerSchema } from '../validation.ts';
import { deleteListing } from '../listings.ts';

interface UserRow extends User {
  password_hash: string;
}

export function authRoutes(ctx: Ctx): Router {
  const { db, limiters, isProd } = ctx;
  const r = Router();

  r.post('/register', limiters.register, async (req, res) => {
    const data = parseBody(registerSchema, req.body);
    if (db.get('SELECT 1 FROM users WHERE email = ?', data.email)) {
      throw new HttpError(409, 'Já existe uma conta com este e-mail.', { email: 'Este e-mail já está cadastrado. Faça login.' });
    }
    const user: User = { id: newId(), name: data.name, email: data.email, role: 'anunciante' };
    const hash = await hashPassword(data.password);
    const at = nowIso();
    try {
      db.run(
        "INSERT INTO users (id, name, email, password_hash, role, terms_version, consent_at, created_at) VALUES (?,?,?,?,'anunciante',?,?,?)",
        user.id, user.name, user.email, hash, TERMS_VERSION, at, at,
      );
    } catch {
      throw new HttpError(409, 'Já existe uma conta com este e-mail.', { email: 'Este e-mail já está cadastrado. Faça login.' });
    }
    createSession(db, req, res, user.id, isProd);
    res.status(201).json({ user });
  });

  r.post('/login', limiters.login, async (req, res) => {
    const GENERIC = 'E-mail ou senha incorretos.';
    const parsed = loginSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new HttpError(401, GENERIC);
    const row = db.get<UserRow>('SELECT id, name, email, role, password_hash FROM users WHERE email = ?', parsed.data.email);
    // Sempre calcula um hash, exista ou não a conta (não revela e-mails por tempo de resposta).
    const ok = await verifyPassword(parsed.data.password, row?.password_hash ?? DUMMY_HASH);
    if (!row || !ok) throw new HttpError(401, GENERIC);
    createSession(db, req, res, row.id, isProd);
    res.json({ user: { id: row.id, name: row.name, email: row.email, role: row.role } satisfies User });
  });

  r.post('/logout', (req, res) => {
    destroySession(db, req, res, isProd);
    res.json({ ok: true });
  });

  r.get('/me', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ user: req.user ?? null });
  });

  // LGPD — direito à eliminação: apaga conta, anúncios, imagens e sessões.
  r.delete('/account', requireAuth, limiters.write, (req, res) => {
    const user = req.user!;
    if (user.role === 'admin') throw new HttpError(403, 'A conta administrativa não pode ser excluída por aqui.');
    const ids = db.all<{ id: string }>('SELECT id FROM listings WHERE owner_id = ?', user.id);
    for (const { id } of ids) deleteListing(ctx, id);
    db.run('DELETE FROM sessions WHERE user_id = ?', user.id);
    db.run('DELETE FROM users WHERE id = ?', user.id);
    destroySession(db, req, res, isProd);
    res.json({ ok: true });
  });

  return r;
}
