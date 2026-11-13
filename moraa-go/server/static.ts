// Frontend estático (dist/), fallback de SPA, metadados de compartilhamento, sitemap e robots.
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Express, Response } from 'express';
import { cityName, formatBRL, typeName } from '../shared/types.ts';
import type { Ctx } from './context.ts';
import { getBySlug, loadImages } from './listings.ts';

/** Páginas públicas fixas do SPA incluídas no sitemap. */
export const SITEMAP_STATIC = ['/', '/imoveis', '/planos', '/anunciar', '/sobre', '/termos', '/privacidade'];

export const escapeHtml = (s: string) =>
  s.replace(/[&<>"'`]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' })[c]!);

export interface PageMeta {
  title: string;
  description: string;
  url: string;
  image?: string;
}

const OWNED_META =
  /<meta\s+[^>]*(?:property|name)\s*=\s*["'](?:og:title|og:description|og:image|og:image:alt|og:url|og:type|description|twitter:title|twitter:description|twitter:image|twitter:card)["'][^>]*>\s*/gi;

/** Substitui <title> e metatags OG do index.html. Todo valor dinâmico é escapado. */
export function injectMeta(html: string, meta: PageMeta): string {
  const e = escapeHtml;
  const tags = [
    `<title>${e(meta.title)}</title>`,
    `<meta name="description" content="${e(meta.description)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${e(meta.title)}">`,
    `<meta property="og:description" content="${e(meta.description)}">`,
    `<meta property="og:url" content="${e(meta.url)}">`,
    ...(meta.image ? [`<meta property="og:image" content="${e(meta.image)}">`, `<meta name="twitter:card" content="summary_large_image">`] : []),
    `<link rel="canonical" href="${e(meta.url)}">`,
  ].join('\n    ');
  const cleaned = html
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/i, '')
    .replace(OWNED_META, '')
    .replace(/<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*>\s*/gi, '');
  // Função como substituto: evita interpretar "$&" etc. vindos do conteúdo.
  return /<\/head>/i.test(cleaned) ? cleaned.replace(/<\/head>/i, () => `    ${tags}\n  </head>`) : `${tags}\n${cleaned}`;
}

const truncate = (s: string, max: number) => {
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).trimEnd()}…`;
};

export function listingMeta(ctx: Ctx, slug: string): PageMeta | null {
  const row = getBySlug(ctx.db, slug.slice(0, 120));
  if (!row || row.status !== 'ativo') return null;
  const image = loadImages(ctx.db, [row.id]).get(row.id)?.[0];
  const lead = `${typeName(row.type)} para alugar em ${row.neighborhood}, ${cityName(row.city)} — ${formatBRL(row.price)}/mês.`;
  return {
    title: `${row.is_demo ? '[Demonstração] ' : ''}${row.title} — MORAA GO`,
    description: truncate(`${lead} ${row.description}`, 200),
    url: `${ctx.publicUrl}/imovel/${encodeURIComponent(row.slug)}`,
    image: image ? new URL(image.url, `${ctx.publicUrl}/`).href : undefined,
  };
}

const escapeXml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!);

export function buildSitemap(ctx: Ctx): string {
  const rows = ctx.db.all<{ slug: string; updated_at: string }>(
    "SELECT slug, updated_at FROM listings WHERE status = 'ativo' ORDER BY updated_at DESC LIMIT 5000",
  );
  const urls = [
    ...SITEMAP_STATIC.map((p) => `  <url><loc>${escapeXml(ctx.publicUrl + p)}</loc></url>`),
    ...rows.map(
      (r) => `  <url><loc>${escapeXml(`${ctx.publicUrl}/imovel/${encodeURIComponent(r.slug)}`)}</loc><lastmod>${r.updated_at.slice(0, 10)}</lastmod></url>`,
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

const NO_CACHE = 'no-cache';

export function mountStatic(app: Express, ctx: Ctx, distDir: string | undefined): void {
  // Imagens enviadas: nomes aleatórios, conteúdo regravado pelo servidor, sem listagem de diretório.
  app.use(
    '/uploads',
    express.static(ctx.uploadsDir, {
      index: false,
      dotfiles: 'deny',
      redirect: false,
      maxAge: '365d',
      immutable: true,
      setHeaders: (res: Response) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
    (_req, res) => {
      res.status(404).json({ error: 'Arquivo não encontrado.' });
    },
  );

  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').setHeader('Cache-Control', 'public, max-age=3600');
    res.send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /minha-conta\nDisallow: /entrar\n\nSitemap: ${ctx.publicUrl}/sitemap.xml\n`);
  });

  app.get('/sitemap.xml', (_req, res) => {
    res.type('application/xml').setHeader('Cache-Control', 'public, max-age=600');
    res.send(buildSitemap(ctx));
  });

  const indexFile = distDir ? path.join(distDir, 'index.html') : '';
  if (!distDir || !fs.existsSync(indexFile)) return;

  app.use(
    express.static(distDir, {
      index: false,
      dotfiles: 'ignore',
      redirect: false,
      setHeaders: (res: Response, file: string) => {
        const rel = path.relative(distDir, file).split(path.sep).join('/');
        if (rel.startsWith('assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        else if (rel === 'sw.js' || rel === 'manifest.webmanifest' || rel.endsWith('.html')) res.setHeader('Cache-Control', NO_CACHE);
        else res.setHeader('Cache-Control', 'public, max-age=86400');
        if (rel.startsWith('img/')) res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );

  let cached: { mtimeMs: number; html: string } | null = null;
  const readIndex = (): string => {
    const { mtimeMs } = fs.statSync(indexFile);
    if (!cached || cached.mtimeMs !== mtimeMs) cached = { mtimeMs, html: fs.readFileSync(indexFile, 'utf8') };
    return cached.html;
  };

  // Fallback do SPA: qualquer GET de navegação fora de /api e /uploads recebe o index.html.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/api/') || req.path === '/api' || req.path.startsWith('/uploads')) return next();
    if (path.extname(req.path)) return next(); // arquivo inexistente → 404, não o SPA
    let html = readIndex();
    const m = /^\/imovel\/([^/]+)\/?$/.exec(req.path);
    if (m) {
      let slug = m[1];
      try {
        slug = decodeURIComponent(slug);
      } catch {
        /* mantém o valor bruto */
      }
      const meta = listingMeta(ctx, slug);
      if (meta) html = injectMeta(html, meta);
    }
    res.status(200).type('html').setHeader('Cache-Control', NO_CACHE);
    res.send(html);
  });
}
