// Acesso a dados e mapeamento de anúncios (visão pública x visão do dono/admin).
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { CITIES, cityName, typeName } from '../shared/types.ts';
import type { CityId, FeatureId, Listing, ListingImage, ListingStatus, OwnedListing, PropertyTypeId } from '../shared/types.ts';
import type { Db } from './db.ts';
import { nowIso } from './db.ts';
import { normalize } from './validation.ts';
import type { ListingData } from './validation.ts';
import { HttpError, newId } from './security.ts';
import type { Ctx } from './context.ts';

export interface ListingRow {
  id: string;
  slug: string;
  owner_id: string;
  title: string;
  description: string;
  type: PropertyTypeId;
  city: CityId;
  neighborhood: string;
  price: number;
  condo_fee: number | null;
  iptu: number | null;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  area_m2: number | null;
  features: string;
  is_demo: number;
  featured: number;
  status: ListingStatus;
  approved: number;
  paused_by: string | null;
  whatsapp: string | null;
  whatsapp_authorized: number;
  approx_lat: number;
  approx_lng: number;
  views: number;
  contact_clicks: number;
  moderation_note: string | null;
  created_at: string;
  updated_at: string;
  owner_name: string;
  owner_email: string;
}

interface ImageRow {
  id: string;
  listing_id: string;
  url: string;
  thumb_url: string;
  alt: string;
  file: string | null;
  thumb_file: string | null;
}

export const LISTING_SELECT = 'SELECT l.*, u.name AS owner_name, u.email AS owner_email FROM listings l JOIN users u ON u.id = l.owner_id';

export const featuresToCsv = (f: readonly string[]) => (f.length ? `,${f.join(',')},` : ',');
const csvToFeatures = (s: string) => s.split(',').filter(Boolean) as FeatureId[];

/** Apenas primeiro nome do anunciante (ou nome completo da conta de demonstração). */
function advertiserName(row: ListingRow): string {
  if (row.is_demo) return row.owner_name;
  return row.owner_name.trim().split(/\s+/)[0] || 'Anunciante';
}

/** Visão pública: construída campo a campo — telefone, e-mail e dono nunca entram aqui. */
export function toPublic(row: ListingRow, images: ListingImage[]): Listing {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    type: row.type,
    city: row.city,
    neighborhood: row.neighborhood,
    price: row.price,
    condoFee: row.condo_fee,
    iptu: row.iptu,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
    parking: row.parking,
    areaM2: row.area_m2,
    features: csvToFeatures(row.features),
    images,
    isDemo: !!row.is_demo,
    featured: !!row.featured,
    status: row.status,
    approxLat: row.approx_lat,
    approxLng: row.approx_lng,
    advertiserName: advertiserName(row),
    whatsappAuthorized: !!row.whatsapp_authorized && !row.is_demo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toOwned(row: ListingRow, images: ListingImage[], extra: { ownerEmail?: boolean } = {}): OwnedListing {
  return {
    ...toPublic(row, images),
    views: row.views,
    contactClicks: row.contact_clicks,
    moderationNote: row.moderation_note,
    ownerId: row.owner_id,
    ...(extra.ownerEmail ? { ownerEmail: row.owner_email } : {}),
  };
}

export function loadImages(db: Db, listingIds: string[]): Map<string, ListingImage[]> {
  const map = new Map<string, ListingImage[]>(listingIds.map((id) => [id, []]));
  for (let i = 0; i < listingIds.length; i += 200) {
    const chunk = listingIds.slice(i, i + 200);
    const rows = db.all<ImageRow>(
      `SELECT id, listing_id, url, thumb_url, alt FROM images WHERE listing_id IN (${chunk.map(() => '?').join(',')}) ORDER BY position, created_at`,
      ...chunk,
    );
    for (const r of rows) map.get(r.listing_id)?.push({ id: r.id, url: r.url, thumbUrl: r.thumb_url, alt: r.alt });
  }
  return map;
}

export function hydrate<T>(db: Db, rows: ListingRow[], mapper: (row: ListingRow, images: ListingImage[]) => T): T[] {
  const images = loadImages(db, rows.map((r) => r.id));
  return rows.map((r) => mapper(r, images.get(r.id) ?? []));
}

export const hydrateOne = <T>(db: Db, row: ListingRow, mapper: (row: ListingRow, images: ListingImage[]) => T): T => hydrate(db, [row], mapper)[0];

export const getById = (db: Db, id: string) => db.get<ListingRow>(`${LISTING_SELECT} WHERE l.id = ?`, id);
export const getBySlug = (db: Db, slug: string) => db.get<ListingRow>(`${LISTING_SELECT} WHERE l.slug = ?`, slug);

/** Anúncio do próprio usuário; 404 para qualquer outro (não revela existência). */
export function getOwned(db: Db, id: string, userId: string): ListingRow {
  const row = getById(db, id);
  if (!row || row.owner_id !== userId) throw new HttpError(404, 'Anúncio não encontrado.');
  return row;
}

export function slugify(title: string): string {
  return normalize(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '') || 'imovel';
}

export const makeSlug = (title: string) => `${slugify(title)}-${randomBytes(4).toString('hex').slice(0, 6)}`;

/**
 * Coordenadas aproximadas: centro da cidade + pequeno deslocamento determinístico
 * derivado do nome do bairro, arredondado a 2 casas. Nunca vem de endereço.
 */
export function approxCoords(city: CityId, neighborhood: string): { lat: number; lng: number } {
  const c = CITIES.find((x) => x.id === city) ?? CITIES[0];
  const h = createHash('sha256').update(`${city}|${normalize(neighborhood)}`).digest();
  const off = (n: number) => (n / 65535 - 0.5) * 0.06; // ±0,03° (~3 km)
  const round = (n: number) => Math.round(n * 100) / 100;
  return { lat: round(c.lat + off(h.readUInt16BE(0))), lng: round(c.lng + off(h.readUInt16BE(2))) };
}

export function searchTextOf(d: { title: string; description: string; neighborhood: string; city: string; type: string }): string {
  return normalize([d.title, d.neighborhood, cityName(d.city), typeName(d.type), d.description].join(' '));
}

export interface InsertOptions {
  ownerId: string;
  slug?: string;
  status?: ListingStatus;
  isDemo?: boolean;
  featured?: boolean;
  createdAt?: string;
}

export function insertListing(db: Db, data: ListingData, o: InsertOptions): string {
  const id = newId();
  const at = o.createdAt ?? nowIso();
  const { lat, lng } = approxCoords(data.city, data.neighborhood);
  const status = o.status ?? 'pendente';
  db.run(
    `INSERT INTO listings (id, slug, owner_id, title, description, type, city, neighborhood, neighborhood_norm, search_text,
       price, condo_fee, iptu, bedrooms, bathrooms, parking, area_m2, features, is_demo, featured, status, approved,
       whatsapp, whatsapp_authorized, ownership_declared_at, approx_lat, approx_lng, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id, o.slug ?? makeSlug(data.title), o.ownerId, data.title, data.description, data.type, data.city, data.neighborhood,
    normalize(data.neighborhood), searchTextOf(data), data.price, data.condoFee, data.iptu, data.bedrooms, data.bathrooms,
    data.parking, data.areaM2, featuresToCsv(data.features), o.isDemo ? 1 : 0, o.featured ? 1 : 0, status, status === 'ativo' ? 1 : 0,
    data.whatsapp, data.whatsappAuthorized ? 1 : 0, at, lat, lng, at, at,
  );
  return id;
}

function unlinkQuiet(dir: string, name: string | null): void {
  if (!name || path.basename(name) !== name) return;
  try {
    fs.unlinkSync(path.join(dir, name));
  } catch {
    /* arquivo já removido */
  }
}

export function removeImageFiles(ctx: Ctx, rows: { file: string | null; thumb_file: string | null }[]): void {
  for (const r of rows) {
    unlinkQuiet(ctx.uploadsDir, r.file);
    unlinkQuiet(ctx.uploadsDir, r.thumb_file);
  }
}

/** Remove o anúncio, suas imagens (linhas e arquivos) e denúncias associadas. */
export function deleteListing(ctx: Ctx, id: string): void {
  const files = ctx.db.all<{ file: string | null; thumb_file: string | null }>('SELECT file, thumb_file FROM images WHERE listing_id = ?', id);
  ctx.db.run('DELETE FROM listings WHERE id = ?', id);
  removeImageFiles(ctx, files);
}
