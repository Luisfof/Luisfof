import { Router } from 'express';
import type { AdminMetrics, ListingStatus, OwnedListing, Report } from '../../shared/types.ts';
import { CITIES, PLANS } from '../../shared/types.ts';
import type { Ctx } from '../context.ts';
import { nowIso } from '../db.ts';
import { DEMO_USER_EMAIL } from '../config.ts';
import { HttpError, audit, requireAdmin } from '../security.ts';
import { STATUS_IDS, moderateSchema, parseBody, resolveSchema } from '../validation.ts';
import { LISTING_SELECT, deleteListing, getById, hydrate, hydrateOne, toOwned } from '../listings.ts';
import type { ListingRow } from '../listings.ts';

const REPORT_SELECT = `SELECT r.id, r.listing_id AS listingId, l.title AS listingTitle, l.slug AS listingSlug, r.reason, r.details,
  r.status, r.resolution, r.created_at AS createdAt FROM reports r JOIN listings l ON l.id = r.listing_id`;

export function adminRoutes(ctx: Ctx): Router {
  const { db } = ctx;
  const r = Router();
  r.use(requireAdmin);
  r.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  const asAdmin = (row: ListingRow, images: OwnedListing['images']) => toOwned(row, images, { ownerEmail: true });
  const find = (id: string): ListingRow => {
    const row = getById(db, id);
    if (!row) throw new HttpError(404, 'Anúncio não encontrado.');
    return row;
  };

  r.get('/metrics', (_req, res) => {
    const listings: Record<ListingStatus, number> = { pendente: 0, ativo: 0, pausado: 0, rejeitado: 0 };
    for (const s of db.all<{ status: ListingStatus; n: number }>('SELECT status, COUNT(*) AS n FROM listings GROUP BY status')) listings[s.status] = s.n;
    const totals = db.get<{ v: number; c: number; d: number }>(
      'SELECT COALESCE(SUM(views),0) AS v, COALESCE(SUM(contact_clicks),0) AS c, COALESCE(SUM(is_demo),0) AS d FROM listings',
    )!;
    const planInterest: Record<string, number> = Object.fromEntries(PLANS.map((p) => [p.id, 0]));
    for (const p of db.all<{ plan: string; count: number }>('SELECT plan, count FROM plan_interest')) planInterest[p.plan] = p.count;
    const byCity: Record<string, number> = Object.fromEntries(CITIES.map((c) => [c.id, 0]));
    for (const c of db.all<{ city: string; n: number }>('SELECT city, COUNT(*) AS n FROM listings GROUP BY city')) byCity[c.city] = c.n;
    const metrics: AdminMetrics = {
      listings,
      demoListings: totals.d,
      users: db.get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE role = 'anunciante' AND email <> ?", DEMO_USER_EMAIL)!.n,
      openReports: db.get<{ n: number }>("SELECT COUNT(*) AS n FROM reports WHERE status = 'aberta'")!.n,
      totalViews: totals.v,
      totalContactClicks: totals.c,
      planInterest,
      byCity,
    };
    res.json(metrics);
  });

  r.get('/listings', (req, res) => {
    const status = STATUS_IDS.find((s) => s === req.query.status);
    const rows = status
      ? db.all<ListingRow>(`${LISTING_SELECT} WHERE l.status = ? ORDER BY l.updated_at DESC LIMIT 500`, status)
      : db.all<ListingRow>(`${LISTING_SELECT} ORDER BY (l.status = 'pendente') DESC, l.updated_at DESC LIMIT 500`);
    res.json(hydrate(db, rows, asAdmin) satisfies OwnedListing[]);
  });

  r.post('/listings/:id/moderate', (req, res) => {
    const row = find(req.params.id);
    const { action, note } = parseBody(moderateSchema, req.body);
    const at = nowIso();
    switch (action) {
      case 'aprovar':
        db.run("UPDATE listings SET status = 'ativo', approved = 1, paused_by = NULL, moderation_note = ?, updated_at = ? WHERE id = ?", note, at, row.id);
        break;
      case 'rejeitar':
        db.run("UPDATE listings SET status = 'rejeitado', approved = 0, featured = 0, paused_by = NULL, moderation_note = ?, updated_at = ? WHERE id = ?", note, at, row.id);
        break;
      case 'pausar':
        if (row.status !== 'ativo') throw new HttpError(409, 'Só é possível pausar um anúncio ativo.');
        db.run("UPDATE listings SET status = 'pausado', paused_by = 'admin', moderation_note = COALESCE(?, moderation_note), updated_at = ? WHERE id = ?", note, at, row.id);
        break;
      case 'destacar':
        db.run('UPDATE listings SET featured = 1, updated_at = ? WHERE id = ?', at, row.id);
        break;
      case 'remover-destaque':
        db.run('UPDATE listings SET featured = 0, updated_at = ? WHERE id = ?', at, row.id);
        break;
    }
    audit(db, req.user!.id, `listing.${action}`, 'listing', row.id, note);
    res.json(hydrateOne(db, find(row.id), asAdmin));
  });

  r.delete('/listings/:id', (req, res) => {
    const row = find(req.params.id);
    deleteListing(ctx, row.id);
    audit(db, req.user!.id, 'listing.excluir', 'listing', row.id, row.title);
    res.json({ ok: true });
  });

  r.get('/reports', (req, res) => {
    const status = (['aberta', 'resolvida'] as const).find((s) => s === req.query.status);
    const rows = status
      ? db.all<Report>(`${REPORT_SELECT} WHERE r.status = ? ORDER BY r.created_at DESC LIMIT 500`, status)
      : db.all<Report>(`${REPORT_SELECT} ORDER BY (r.status = 'aberta') DESC, r.created_at DESC LIMIT 500`);
    res.json(rows.map((x) => ({ ...x })) satisfies Report[]);
  });

  r.post('/reports/:id/resolve', (req, res) => {
    const { resolution } = parseBody(resolveSchema, req.body);
    const changed = db.run("UPDATE reports SET status = 'resolvida', resolution = ?, resolved_at = ? WHERE id = ?", resolution, nowIso(), String(req.params.id));
    if (!changed) throw new HttpError(404, 'Denúncia não encontrada.');
    audit(db, req.user!.id, 'report.resolver', 'report', String(req.params.id), resolution);
    res.json({ ...db.get<Report>(`${REPORT_SELECT} WHERE r.id = ?`, String(req.params.id))! });
  });

  return r;
}
