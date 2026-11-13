import { Router } from 'express';
import type { OwnedListing } from '../../shared/types.ts';
import type { Ctx } from '../context.ts';
import { nowIso } from '../db.ts';
import { HttpError, newId, requireAuth } from '../security.ts';
import { listingSchema, normalize, ownerStatusSchema, parseBody } from '../validation.ts';
import {
  LISTING_SELECT, approxCoords, deleteListing, featuresToCsv, getById, getOwned, hydrate, hydrateOne, insertListing,
  removeImageFiles, searchTextOf, toOwned,
} from '../listings.ts';
import type { ListingRow } from '../listings.ts';
import type { StoredImage } from '../images.ts';
import { MAX_IMAGES, processImage, upload } from '../images.ts';

export const FREE_PLAN_LIMIT = 3;

export function myRoutes(ctx: Ctx): Router {
  const { db, limiters } = ctx;
  const r = Router();
  r.use(requireAuth);
  r.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  const owned = (id: string, userId: string): OwnedListing => hydrateOne(db, getOwned(db, id, userId), toOwned);

  r.get('/listings', (req, res) => {
    const rows = db.all<ListingRow>(`${LISTING_SELECT} WHERE l.owner_id = ? ORDER BY l.created_at DESC`, req.user!.id);
    res.json(hydrate(db, rows, toOwned) satisfies OwnedListing[]);
  });

  r.post('/listings', limiters.write, (req, res) => {
    const user = req.user!;
    const data = parseBody(listingSchema, req.body);
    if (user.role !== 'admin') {
      const { n } = db.get<{ n: number }>("SELECT COUNT(*) AS n FROM listings WHERE owner_id = ? AND status <> 'rejeitado'", user.id)!;
      if (n >= FREE_PLAN_LIMIT) {
        throw new HttpError(409, `O plano gratuito permite até ${FREE_PLAN_LIMIT} anúncios. Exclua um anúncio para cadastrar outro.`);
      }
    }
    const id = insertListing(db, data, { ownerId: user.id, status: 'pendente' });
    res.status(201).json(owned(id, user.id));
  });

  r.get('/listings/:id', (req, res) => {
    const row = getOwned(db, String(req.params.id), req.user!.id);
    // `whatsapp` só aparece aqui, para o próprio dono editar.
    res.json({ ...hydrateOne(db, row, toOwned), whatsapp: row.whatsapp });
  });

  r.put('/listings/:id', limiters.write, (req, res) => {
    const user = req.user!;
    const row = getOwned(db, String(req.params.id), user.id);
    if (row.is_demo) throw new HttpError(403, 'Anúncios demonstrativos não podem ser editados.');
    const data = parseBody(listingSchema, req.body);
    // Qualquer edição exige nova moderação antes de voltar a ficar pública.
    const status = row.status === 'ativo' || row.status === 'rejeitado' ? 'pendente' : row.status;
    const { lat, lng } = approxCoords(data.city, data.neighborhood);
    db.run(
      `UPDATE listings SET title=?, description=?, type=?, city=?, neighborhood=?, neighborhood_norm=?, search_text=?, price=?, condo_fee=?,
         iptu=?, bedrooms=?, bathrooms=?, parking=?, area_m2=?, features=?, whatsapp=?, whatsapp_authorized=?, ownership_declared_at=?,
         approx_lat=?, approx_lng=?, status=?, approved=0, moderation_note=CASE WHEN ? = 'pendente' THEN NULL ELSE moderation_note END, updated_at=?
       WHERE id = ?`,
      data.title, data.description, data.type, data.city, data.neighborhood, normalize(data.neighborhood), searchTextOf(data), data.price,
      data.condoFee, data.iptu, data.bedrooms, data.bathrooms, data.parking, data.areaM2, featuresToCsv(data.features), data.whatsapp,
      data.whatsappAuthorized ? 1 : 0, nowIso(), lat, lng, status, status, nowIso(), row.id,
    );
    res.json(owned(row.id, user.id));
  });

  r.post('/listings/:id/status', limiters.write, (req, res) => {
    const user = req.user!;
    const row = getOwned(db, String(req.params.id), user.id);
    const { status } = parseBody(ownerStatusSchema, req.body);
    if (status === 'pausado') {
      if (row.status !== 'ativo') throw new HttpError(409, 'Só é possível pausar um anúncio ativo.');
      db.run("UPDATE listings SET status = 'pausado', paused_by = 'owner', updated_at = ? WHERE id = ?", nowIso(), row.id);
    } else {
      if (row.status !== 'pausado') throw new HttpError(409, 'Só é possível reativar um anúncio pausado.');
      if (row.paused_by !== 'owner') throw new HttpError(409, 'Este anúncio foi pausado pela moderação e não pode ser reativado por aqui.');
      // Volta a ficar ativo apenas se o conteúdo atual já foi aprovado; senão, vai para moderação.
      db.run('UPDATE listings SET status = ?, paused_by = NULL, updated_at = ? WHERE id = ?', row.approved ? 'ativo' : 'pendente', nowIso(), row.id);
    }
    res.json(owned(row.id, user.id));
  });

  r.delete('/listings/:id', limiters.write, (req, res) => {
    const row = getOwned(db, String(req.params.id), req.user!.id);
    deleteListing(ctx, row.id);
    res.json({ ok: true });
  });

  r.post(
    '/listings/:id/images',
    limiters.upload,
    (req, _res, next) => {
      // Autorização ANTES de aceitar qualquer byte do upload.
      const row = getOwned(db, String(req.params.id), req.user!.id);
      if (row.is_demo) return next(new HttpError(403, 'Anúncios demonstrativos não podem ser editados.'));
      next();
    },
    upload,
    async (req, res) => {
      const user = req.user!;
      const id = String(req.params.id);
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) throw new HttpError(400, 'Selecione ao menos uma foto (campo "images").');
      const count = () => db.get<{ n: number; p: number | null }>('SELECT COUNT(*) AS n, MAX(position) AS p FROM images WHERE listing_id = ?', id)!;
      if (count().n + files.length > MAX_IMAGES) throw new HttpError(400, `Cada anúncio pode ter no máximo ${MAX_IMAGES} fotos.`);

      const stored: StoredImage[] = [];
      try {
        for (const f of files) stored.push(await processImage(f.buffer, ctx.uploadsDir));
      } catch (err) {
        removeImageFiles(ctx, stored.map((s) => ({ file: s.file, thumb_file: s.thumbFile })));
        throw err;
      }

      const row = getById(db, id);
      const now = count();
      if (!row || row.owner_id !== user.id || now.n + stored.length > MAX_IMAGES) {
        removeImageFiles(ctx, stored.map((s) => ({ file: s.file, thumb_file: s.thumbFile })));
        throw new HttpError(row ? 400 : 404, row ? `Cada anúncio pode ter no máximo ${MAX_IMAGES} fotos.` : 'Anúncio não encontrado.');
      }
      db.tx(() => {
        let pos = (now.p ?? -1) + 1;
        for (const s of stored) {
          db.run(
            'INSERT INTO images (id, listing_id, url, thumb_url, alt, position, file, thumb_file, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
            newId(), id, `/uploads/${s.file}`, `/uploads/${s.thumbFile}`, `Foto ${pos + 1} do imóvel`, pos, s.file, s.thumbFile, nowIso(),
          );
          pos++;
        }
        // Fotos novas em anúncio público também passam por moderação.
        db.run("UPDATE listings SET status = CASE WHEN status = 'ativo' THEN 'pendente' ELSE status END, approved = 0, updated_at = ? WHERE id = ?", nowIso(), id);
      });
      res.status(201).json(owned(id, user.id));
    },
  );

  r.delete('/listings/:id/images/:imageId', limiters.write, (req, res) => {
    const user = req.user!;
    const row = getOwned(db, String(req.params.id), user.id);
    const img = db.get<{ id: string; file: string | null; thumb_file: string | null }>(
      'SELECT id, file, thumb_file FROM images WHERE id = ? AND listing_id = ?', String(req.params.imageId), row.id,
    );
    if (!img) throw new HttpError(404, 'Imagem não encontrada.');
    db.run('DELETE FROM images WHERE id = ?', img.id);
    removeImageFiles(ctx, [img]);
    db.run('UPDATE listings SET updated_at = ? WHERE id = ?', nowIso(), row.id);
    res.json(owned(row.id, user.id));
  });

  return r;
}
