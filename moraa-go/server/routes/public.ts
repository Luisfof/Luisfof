import { Router } from 'express';
import type { ContactResponse, Listing, Meta, SearchResult } from '../../shared/types.ts';
import { CITIES } from '../../shared/types.ts';
import type { SQLInputValue } from 'node:sqlite';
import type { Ctx } from '../context.ts';
import { nowIso } from '../db.ts';
import { HttpError, newId } from '../security.ts';
import { normalize, parseBody, planSchema, reportSchema, searchSchema, toFields } from '../validation.ts';
import { LISTING_SELECT, getById, getBySlug, hydrate, hydrateOne, toPublic } from '../listings.ts';
import type { ListingRow } from '../listings.ts';

export const PAGE_SIZE = 12;
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function publicRoutes(ctx: Ctx): Router {
  const { db, limiters } = ctx;
  const r = Router();

  r.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  r.get('/meta', (_req, res) => {
    const rows = db.all<{ city: string; neighborhood: string; n: number }>(
      "SELECT city, neighborhood, COUNT(*) AS n FROM listings WHERE status = 'ativo' GROUP BY city, neighborhood_norm ORDER BY neighborhood COLLATE NOCASE",
    );
    const meta: Meta = {
      neighborhoods: Object.fromEntries(CITIES.map((c) => [c.id, [] as string[]])),
      counts: Object.fromEntries(CITIES.map((c) => [c.id, 0])),
      demoMode: !!db.get('SELECT 1 FROM listings WHERE is_demo = 1 LIMIT 1'),
    };
    for (const row of rows) {
      (meta.neighborhoods[row.city] ??= []).push(row.neighborhood);
      meta.counts[row.city] = (meta.counts[row.city] ?? 0) + row.n;
    }
    for (const list of Object.values(meta.neighborhoods)) list.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    res.json(meta);
  });

  r.get('/listings', (req, res) => {
    const parsed = searchSchema.safeParse(req.query);
    if (!parsed.success) throw new HttpError(400, 'Filtros de busca inválidos.', toFields(parsed.error));
    const q = parsed.data;

    const where: string[] = ["l.status = 'ativo'"];
    const params: SQLInputValue[] = [];
    if (q.q) {
      for (const term of normalize(q.q).split(' ').filter(Boolean).slice(0, 6)) {
        where.push("l.search_text LIKE ? ESCAPE '\\'");
        params.push(`%${likeEscape(term)}%`);
      }
    }
    if (q.city) (where.push('l.city = ?'), params.push(q.city));
    if (q.type) (where.push('l.type = ?'), params.push(q.type));
    if (q.neighborhood) (where.push('l.neighborhood_norm = ?'), params.push(normalize(q.neighborhood)));
    if (q.minPrice !== undefined) (where.push('l.price >= ?'), params.push(Math.max(0, q.minPrice)));
    if (q.maxPrice !== undefined) (where.push('l.price <= ?'), params.push(Math.max(0, q.maxPrice)));
    if (q.bedrooms !== undefined) (where.push('l.bedrooms >= ?'), params.push(Math.max(0, Math.floor(q.bedrooms))));
    for (const f of q.features ?? []) {
      where.push('l.features LIKE ?');
      params.push(`%,${f},%`);
    }
    // Destaques sobem apenas na ordenação padrão; ao ordenar por preço, a ordem é estritamente pelo preço.
    const order = { recentes: 'l.featured DESC, l.created_at DESC', 'menor-preco': 'l.price ASC, l.created_at DESC', 'maior-preco': 'l.price DESC, l.created_at DESC' }[q.sort ?? 'recentes'];
    const page = Math.min(10000, Math.max(1, Math.floor(q.page ?? 1)));
    const cond = where.join(' AND ');

    const { n: total } = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM listings l WHERE ${cond}`, ...params)!;
    const rows = db.all<ListingRow>(
      `${LISTING_SELECT} WHERE ${cond} ORDER BY ${order}, l.id LIMIT ? OFFSET ?`,
      ...params, PAGE_SIZE, (page - 1) * PAGE_SIZE,
    );
    const result: SearchResult = { items: hydrate(db, rows, toPublic), total, page, pageSize: PAGE_SIZE };
    res.json(result);
  });

  r.get('/listings/featured', (_req, res) => {
    let rows = db.all<ListingRow>(`${LISTING_SELECT} WHERE l.status = 'ativo' AND l.featured = 1 ORDER BY l.created_at DESC LIMIT 6`);
    if (rows.length === 0) rows = db.all<ListingRow>(`${LISTING_SELECT} WHERE l.status = 'ativo' ORDER BY l.created_at DESC LIMIT 6`);
    res.json(hydrate(db, rows, toPublic) satisfies Listing[]);
  });

  r.get('/listings/:slug', (req, res) => {
    const row = getBySlug(db, String(req.params.slug).slice(0, 120));
    const privileged = !!row && !!req.user && (req.user.id === row.owner_id || req.user.role === 'admin');
    if (!row || (row.status !== 'ativo' && !privileged)) throw new HttpError(404, 'Anúncio não encontrado.');
    if (!privileged) db.run('UPDATE listings SET views = views + 1 WHERE id = ?', row.id);
    if (privileged) res.setHeader('Cache-Control', 'no-store');
    res.json(hydrateOne(db, row, toPublic));
  });

  // O telefone só sai daqui, mediante clique, e apenas com consentimento do anunciante.
  r.post('/listings/:id/contact', limiters.contact, (req, res) => {
    const row = getById(db, String(req.params.id));
    if (!row || row.status !== 'ativo') throw new HttpError(404, 'Anúncio não encontrado.');
    db.run('UPDATE listings SET contact_clicks = contact_clicks + 1 WHERE id = ?', row.id);
    res.setHeader('Cache-Control', 'no-store');
    let out: ContactResponse;
    if (row.is_demo) {
      out = { kind: 'demo', message: 'Este é um anúncio demonstrativo. Não há um imóvel real nem um contato disponível.' };
    } else if (row.whatsapp_authorized && row.whatsapp && /^\d{10,11}$/.test(row.whatsapp)) {
      const text = `Olá! Vi o anúncio "${row.title}" no MORAA GO e gostaria de mais informações.`;
      out = {
        kind: 'whatsapp',
        whatsappUrl: `https://wa.me/55${row.whatsapp}?text=${encodeURIComponent(text)}`,
        message: 'Abrindo a conversa no WhatsApp. Nunca faça pagamentos antes de visitar o imóvel.',
      };
    } else {
      out = { kind: 'indisponivel', message: 'O anunciante não autorizou o contato por WhatsApp neste anúncio.' };
    }
    res.json(out);
  });

  r.post('/listings/:id/report', limiters.report, (req, res) => {
    const data = parseBody(reportSchema, req.body);
    const row = getById(db, String(req.params.id));
    if (!row || row.status !== 'ativo') throw new HttpError(404, 'Anúncio não encontrado.');
    db.run('INSERT INTO reports (id, listing_id, reason, details, created_at) VALUES (?,?,?,?,?)', newId(), row.id, data.reason, data.details, nowIso());
    res.status(201).json({ ok: true });
  });

  // Apenas um contador agregado — não há pagamento nem dado pessoal.
  r.post('/plans/interest', limiters.planInterest, (req, res) => {
    const { plan } = parseBody(planSchema, req.body);
    db.run('INSERT INTO plan_interest (plan, count) VALUES (?, 1) ON CONFLICT(plan) DO UPDATE SET count = count + 1', plan);
    res.status(201).json({ ok: true });
  });

  return r;
}
