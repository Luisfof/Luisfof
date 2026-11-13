import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import type { Express } from 'express';
import { createApp, getCtx } from '../server/app.ts';
import { configFromEnv, ConfigError, DEMO_USER_EMAIL } from '../server/config.ts';
import type { AppOptions } from '../server/config.ts';
import { injectMeta } from '../server/static.ts';
import { approxCoords } from '../server/listings.ts';
import { seedDemo } from '../server/seed.ts';
import { hashPassword, parseCookies, sha256, verifyPassword } from '../server/security.ts';
import { sniffImage } from '../server/images.ts';
import { CITIES } from '../shared/types.ts';
import type { Listing, OwnedListing, SearchResult } from '../shared/types.ts';

const ADMIN = { email: 'admin@teste.local', password: 'senha-admin-de-teste' };
const PHONE = '62999887766';
const tmpDirs: string[] = [];
const apps: Express[] = [];

function makeApp(extra: Partial<AppOptions> = {}): Express {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moraa-test-'));
  tmpDirs.push(dataDir);
  const app = createApp({
    dataDir,
    nodeEnv: 'test',
    adminEmail: ADMIN.email,
    adminPassword: ADMIN.password,
    seedDemo: true,
    rateLimits: false,
    publicUrl: 'https://moraago.example',
    distDir: path.join(dataDir, 'sem-dist'),
    ...extra,
  });
  apps.push(app);
  return app;
}

const agentFor = (app: Express) => request.agent(app).set('X-Requested-With', 'moraa');
type Agent = ReturnType<typeof agentFor>;

let seq = 0;
async function newUser(app: Express, name = 'Ana Souza') {
  const email = `pessoa${++seq}@exemplo.com`;
  const agent = agentFor(app);
  const res = await agent.post('/api/auth/register').send({ name, email, password: 'senha-bem-longa-1', acceptTerms: true });
  expect(res.status).toBe(201);
  return { agent, email, user: res.body.user as { id: string } };
}

async function adminAgent(app: Express): Promise<Agent> {
  const agent = agentFor(app);
  const res = await agent.post('/api/auth/login').send(ADMIN);
  expect(res.status).toBe(200);
  expect(res.body.user.role).toBe('admin');
  return agent;
}

const input = (over: Record<string, unknown> = {}) => ({
  title: 'Casa ampla com três quartos e quintal',
  description: 'Casa bem localizada, com três quartos, sala ampla, cozinha planejada e quintal nos fundos.',
  type: 'casa',
  city: 'senador-canedo',
  neighborhood: 'Jardim Flamboyant',
  price: 1500,
  condoFee: null,
  iptu: 80,
  bedrooms: 3,
  bathrooms: 2,
  parking: 1,
  areaM2: 110,
  features: ['garagem', 'quintal'],
  whatsapp: PHONE,
  whatsappAuthorized: true,
  ownershipDeclared: true,
  ...over,
});

async function createListing(agent: Agent, over: Record<string, unknown> = {}): Promise<OwnedListing> {
  const res = await agent.post('/api/my/listings').send(input(over));
  expect(res.status).toBe(201);
  return res.body;
}

async function moderate(admin: Agent, id: string, action: string, note?: string) {
  return admin.post(`/api/admin/listings/${id}/moderate`).send({ action, note });
}

const png = (w = 1600, h = 900) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 40 } } }).png().toBuffer();

let app: Express;
let admin: Agent;

beforeAll(async () => {
  app = makeApp();
  admin = await adminAgent(app);
});

afterAll(() => {
  for (const a of apps) getCtx(a).db.close();
  for (const d of tmpDirs) fs.rmSync(d, { recursive: true, force: true });
});

describe('básico', () => {
  it('health', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('cabeçalhos de segurança', async () => {
    const res = await request(app).get('/api/health');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('meta', async () => {
    const res = await request(app).get('/api/meta');
    expect(res.status).toBe(200);
    expect(res.body.demoMode).toBe(true);
    expect(res.body.counts['senador-canedo']).toBe(5);
    expect(res.body.counts.goiania).toBe(4);
    expect(res.body.counts.trindade).toBe(0);
    expect(res.body.neighborhoods.goiania).toContain('Setor Bueno');
  });

  it('rota de API desconhecida → 404 em JSON', async () => {
    const res = await request(app).get('/api/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTypeOf('string');
  });

  it('JSON malformado → 400; corpo grande → 413', async () => {
    const bad = await request(app).post('/api/auth/login').set('X-Requested-With', 'moraa').set('Content-Type', 'application/json').send('{"email":');
    expect(bad.status).toBe(400);
    const big = await request(app).post('/api/auth/login').set('X-Requested-With', 'moraa').send({ email: 'a@b.co', password: 'x'.repeat(150_000) });
    expect(big.status).toBe(413);
  });
});

describe('seed demonstrativo', () => {
  it('cria exatamente 10 anúncios, todos isDemo, ativos e sem WhatsApp', async () => {
    const p1: SearchResult = (await request(app).get('/api/listings')).body;
    expect(p1.total).toBe(10);
    expect(p1.pageSize).toBe(12);
    expect(p1.items).toHaveLength(10);
    for (const l of p1.items) {
      expect(l.isDemo).toBe(true);
      expect(l.status).toBe('ativo');
      expect(l.whatsappAuthorized).toBe(false);
      expect(l.advertiserName).toBe('Demonstração MORAA GO');
      expect(l.description.endsWith('Anúncio demonstrativo: este imóvel não está disponível para locação.')).toBe(true);
      expect(l.images.length).toBeGreaterThanOrEqual(2);
      expect(l.images[0].url).toMatch(/^\/img\/demo\/[a-z-]+-1280\.webp$/);
      expect(l.images[0].thumbUrl).toMatch(/-640\.webp$/);
    }
    expect(p1.items.filter((l) => l.featured)).toHaveLength(4);
    const row = getCtx(app).db.get<{ n: number }>('SELECT COUNT(*) AS n FROM listings WHERE whatsapp IS NOT NULL OR is_demo = 0');
    expect(row!.n).toBe(0);
  });

  it('é idempotente', () => {
    expect(seedDemo(getCtx(app).db)).toBe(0);
    expect(getCtx(app).db.get<{ n: number }>('SELECT COUNT(*) AS n FROM listings')!.n).toBe(10);
  });

  it('conta demo não permite login', async () => {
    const res = await agentFor(app).post('/api/auth/login').send({ email: DEMO_USER_EMAIL, password: 'qualquer-senha-123' });
    expect(res.status).toBe(401);
  });

  it('coordenadas aproximadas: 2 casas decimais, perto do centro da cidade', () => {
    const c = CITIES[0];
    const p = approxCoords('senador-canedo', 'Jardim das Oliveiras');
    expect(p).toEqual(approxCoords('senador-canedo', 'jardim das oliveiras'));
    expect(Math.abs(p.lat - c.lat)).toBeLessThanOrEqual(0.04);
    expect(Math.abs(p.lng - c.lng)).toBeLessThanOrEqual(0.04);
    expect(Number(p.lat.toFixed(2))).toBe(p.lat);
    expect(Number(p.lng.toFixed(2))).toBe(p.lng);
  });
});

describe('busca', () => {
  const search = async (qs: string): Promise<SearchResult> => {
    const res = await request(app).get(`/api/listings?${qs}`);
    expect(res.status).toBe(200);
    return res.body;
  };

  it('destaques primeiro', async () => {
    const r = await search('');
    const flags = r.items.map((l) => l.featured);
    expect(flags.slice(0, 4)).toEqual([true, true, true, true]);
    expect(flags.slice(4).some(Boolean)).toBe(false);
  });

  it('cidade', async () => {
    const r = await search('city=goiania');
    expect(r.total).toBe(4);
    expect(r.items.every((l) => l.city === 'goiania')).toBe(true);
  });

  it('faixa de preço', async () => {
    const r = await search('minPrice=1500&maxPrice=2000');
    expect(r.items.map((l) => l.price).sort()).toEqual([1600, 1650, 1850]);
  });

  it('quartos (mínimo)', async () => {
    const r = await search('bedrooms=3');
    expect(r.total).toBe(4);
    expect(r.items.every((l) => l.bedrooms >= 3)).toBe(true);
  });

  it('características (todas presentes)', async () => {
    const r = await search('features=piscina,varanda');
    expect(r.total).toBe(2);
    expect(r.items.every((l) => l.features.includes('piscina') && l.features.includes('varanda'))).toBe(true);
    expect((await search('features=piscina,inexistente')).total).toBe(2);
  });

  it('tipo', async () => {
    const r = await search('type=sobrado');
    expect(r.total).toBe(2);
    expect(r.items.every((l) => l.type === 'sobrado')).toBe(true);
  });

  it('bairro (sem diferenciar acentos/maiúsculas)', async () => {
    expect((await search('neighborhood=jardim%20goias')).total).toBe(1);
  });

  it('texto livre, sem diferenciar acentos', async () => {
    expect((await search('q=studio')).items.map((l) => l.type)).toEqual(['kitnet']);
    expect((await search('q=GOIANIA%20piscina')).total).toBe(2); // Goiânia + Aparecida de Goiânia
    expect((await search('q=GOIANIA%20piscina%20vista')).total).toBe(1);
    expect((await search('q=terrea')).total).toBe(1);
    expect((await search('q=100%25')).total).toBe(0);
    expect((await search('q=_')).total).toBe(0);
  });

  it('ordenação por preço é estrita (destaque só sobe na ordenação padrão)', async () => {
    const asc = (await search('sort=menor-preco')).items.map((l) => l.price);
    expect(asc).toEqual([...asc].sort((a, b) => a - b));
    const desc = (await search('sort=maior-preco&city=goiania')).items.map((l) => l.price);
    expect(desc).toEqual([2900, 2400, 1600, 950]);
    const padrao = (await search('')).items;
    expect(padrao.slice(0, 4).every((l) => l.featured)).toBe(true);
  });

  it('recentes: ordem decrescente de criação', async () => {
    const rest = (await search('sort=recentes')).items.filter((l) => !l.featured).map((l) => l.createdAt);
    expect(rest).toEqual([...rest].sort().reverse());
  });

  it('paginação', async () => {
    const p2 = await search('page=2');
    expect(p2.page).toBe(2);
    expect(p2.total).toBe(10);
    expect(p2.items).toHaveLength(0);
  });

  it('valores desconhecidos são ignorados; números malformados → 400', async () => {
    expect((await search('city=atlantida&type=castelo&sort=aleatorio&foo=bar')).total).toBe(10);
    expect((await search('minPrice=&page=')).total).toBe(10);
    for (const qs of ['minPrice=abc', 'maxPrice=1e', 'bedrooms=dois', 'page=x']) {
      const res = await request(app).get(`/api/listings?${qs}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toBeTypeOf('string');
      expect(Object.keys(res.body.fields)).toHaveLength(1);
    }
  });

  it('tentativa de injeção de SQL é tratada como texto', async () => {
    expect((await search(`q=${encodeURIComponent("' OR 1=1 --")}`)).total).toBe(0);
    expect((await search(`neighborhood=${encodeURIComponent("x' OR '1'='1")}`)).total).toBe(0);
    expect((await search('')).total).toBe(10);
  });

  it('featured: até 6 destaques ativos', async () => {
    const res = await request(app).get('/api/listings/featured');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    expect(res.body.every((l: Listing) => l.featured)).toBe(true);
  });

  it('featured: sem destaques, usa os mais recentes', async () => {
    const other = makeApp();
    getCtx(other).db.run('UPDATE listings SET featured = 0');
    const res = await request(other).get('/api/listings/featured');
    expect(res.body).toHaveLength(6);
  });
});

describe('autenticação', () => {
  it('exige cabeçalho CSRF em requisições de escrita', async () => {
    const res = await request(app).post('/api/auth/login').send(ADMIN);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/segurança/);
    const wrong = await request(app).post('/api/auth/logout').set('X-Requested-With', 'XMLHttpRequest');
    expect(wrong.status).toBe(403);
    const plan = await request(app).post('/api/plans/interest').send({ plan: 'basico' });
    expect(plan.status).toBe(403);
  });

  it('rejeita senha fraca, termos não aceitos e e-mail inválido', async () => {
    const a = agentFor(app);
    const weak = await a.post('/api/auth/register').send({ name: 'Bia', email: 'bia@exemplo.com', password: 'curta', acceptTerms: true });
    expect(weak.status).toBe(400);
    expect(weak.body.fields.password).toMatch(/10 caracteres/);
    const terms = await a.post('/api/auth/register').send({ name: 'Bia', email: 'bia@exemplo.com', password: 'senha-bem-longa-1', acceptTerms: false });
    expect(terms.status).toBe(400);
    expect(terms.body.fields.acceptTerms).toBeTypeOf('string');
    const missing = await a.post('/api/auth/register').send({ name: 'Bia', email: 'bia@exemplo.com', password: 'senha-bem-longa-1' });
    expect(missing.body.fields.acceptTerms).toBeTypeOf('string');
    const mail = await a.post('/api/auth/register').send({ name: '<b>Bia</b>', email: 'não-é-email', password: 'senha-bem-longa-1', acceptTerms: true });
    expect(mail.status).toBe(400);
    expect(Object.keys(mail.body.fields).sort()).toEqual(['email', 'name']);
    expect((await a.get('/api/auth/me')).body.user).toBeNull();
  });

  it('registro → me → logout → login', async () => {
    const a = agentFor(app);
    const reg = await a.post('/api/auth/register').send({ name: '  Carla   Dias ', email: ' Carla@Exemplo.com ', password: 'senha-bem-longa-1', acceptTerms: true });
    expect(reg.status).toBe(201);
    expect(reg.body.user).toMatchObject({ name: 'Carla Dias', email: 'carla@exemplo.com', role: 'anunciante' });
    expect(JSON.stringify(reg.body)).not.toMatch(/password|hash/i);

    const cookie = String(reg.headers['set-cookie']);
    expect(cookie).toMatch(/^moraa_sid=[\w-]{43};/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=1209600/);
    expect(cookie).not.toMatch(/Secure/);

    // O banco guarda só o SHA-256 do token, e o consentimento fica registrado.
    const token = parseCookies(cookie.split(';')[0]).moraa_sid;
    const db = getCtx(app).db;
    expect(db.get('SELECT 1 AS ok FROM sessions WHERE token_hash = ?', sha256(token))).toBeTruthy();
    expect(db.get('SELECT 1 AS ok FROM sessions WHERE token_hash = ?', token)).toBeUndefined();
    const row = db.get<{ password_hash: string; consent_at: string; terms_version: string }>('SELECT * FROM users WHERE email = ?', 'carla@exemplo.com')!;
    expect(row.password_hash.startsWith('scrypt$')).toBe(true);
    expect(row.password_hash).not.toContain('senha-bem-longa-1');
    expect(row.consent_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row.terms_version).toBeTruthy();

    expect((await a.get('/api/auth/me')).body.user.email).toBe('carla@exemplo.com');

    const dup = await agentFor(app).post('/api/auth/register').send({ name: 'Outra', email: 'carla@exemplo.com', password: 'senha-bem-longa-2', acceptTerms: true });
    expect(dup.status).toBe(409);

    expect((await a.post('/api/auth/logout')).status).toBe(200);
    expect((await a.get('/api/auth/me')).body.user).toBeNull();
    // O token antigo não vale mais, mesmo reapresentado.
    const replay = await request(app).get('/api/auth/me').set('Cookie', `moraa_sid=${token}`);
    expect(replay.body.user).toBeNull();

    const bad = await a.post('/api/auth/login').send({ email: 'carla@exemplo.com', password: 'senha-errada-123' });
    const unknown = await a.post('/api/auth/login').send({ email: 'ninguem@exemplo.com', password: 'senha-errada-123' });
    expect(bad.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(bad.body).toEqual(unknown.body);

    const ok = await a.post('/api/auth/login').send({ email: 'CARLA@exemplo.com', password: 'senha-bem-longa-1' });
    expect(ok.status).toBe(200);
    const token2 = parseCookies(String(ok.headers['set-cookie']).split(';')[0]).moraa_sid;
    expect(token2).not.toBe(token);

    // Rotação: novo login com o cookie atual invalida o token anterior.
    const again = await a.post('/api/auth/login').send({ email: 'carla@exemplo.com', password: 'senha-bem-longa-1' });
    expect(again.status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', `moraa_sid=${token2}`)).body.user).toBeNull();
    expect((await a.get('/api/auth/me')).body.user.email).toBe('carla@exemplo.com');
  });

  it('cookie Secure em produção', async () => {
    const prod = makeApp({ nodeEnv: 'production', seedDemo: false });
    const res = await agentFor(prod).post('/api/auth/login').send(ADMIN);
    expect(res.status).toBe(200);
    expect(String(res.headers['set-cookie'])).toMatch(/; Secure/);
    expect(res.headers['strict-transport-security']).toBeTruthy();
  });

  it('scrypt: hashes com salt por usuário', async () => {
    const [h1, h2] = await Promise.all([hashPassword('mesma-senha-123'), hashPassword('mesma-senha-123')]);
    expect(h1).not.toBe(h2);
    expect(await verifyPassword('mesma-senha-123', h1)).toBe(true);
    expect(await verifyPassword('outra-senha-123', h1)).toBe(false);
    expect(await verifyPassword('x', 'lixo')).toBe(false);
  });

  it('rotas privadas exigem login; admin exige papel admin', async () => {
    expect((await request(app).get('/api/my/listings')).status).toBe(401);
    expect((await request(app).get('/api/admin/metrics')).status).toBe(401);
    const { agent } = await newUser(app);
    for (const url of ['/api/admin/metrics', '/api/admin/listings', '/api/admin/reports']) {
      expect((await agent.get(url)).status).toBe(403);
    }
    expect((await agent.post('/api/admin/listings/x/moderate').send({ action: 'aprovar' })).status).toBe(403);
    expect((await agent.delete('/api/admin/listings/x')).status).toBe(403);
    expect((await agent.post('/api/admin/reports/x/resolve').send({ resolution: 'ok ok' })).status).toBe(403);
  });

  it('limite de tentativas de login por IP+e-mail', async () => {
    const limited = makeApp({ rateLimits: true, rateLimitMax: { login: 3 }, seedDemo: false });
    const a = agentFor(limited);
    for (let i = 0; i < 3; i++) {
      expect((await a.post('/api/auth/login').send({ email: ADMIN.email, password: 'errada-errada-1' })).status).toBe(401);
    }
    const blocked = await a.post('/api/auth/login').send({ email: ADMIN.email, password: ADMIN.password });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toMatch(/tentativas/);
    // Outro e-mail tem contador próprio.
    expect((await a.post('/api/auth/login').send({ email: 'outra@exemplo.com', password: 'errada-errada-1' })).status).toBe(401);
  });

  it('configuração: produção recusa senha admin ausente ou curta', () => {
    expect(() => configFromEnv({ NODE_ENV: 'production' })).toThrow(ConfigError);
    expect(() => configFromEnv({ NODE_ENV: 'production', ADMIN_EMAIL: 'a@b.co', ADMIN_PASSWORD: 'curta' })).toThrow(ConfigError);
    expect(() => createApp({ dataDir: os.tmpdir(), nodeEnv: 'production', adminEmail: 'a@b.co', adminPassword: 'curta' })).toThrow(ConfigError);
    const prod = configFromEnv({ NODE_ENV: 'production', ADMIN_EMAIL: 'a@b.co', ADMIN_PASSWORD: 'uma-senha-bem-longa', TRUST_PROXY: 'true' });
    expect(prod).toMatchObject({ usingDemoAdmin: false, trustProxy: true, port: 8787 });
    const dev = configFromEnv({});
    expect(dev).toMatchObject({ usingDemoAdmin: true, adminEmail: 'admin@moraago.local', adminPassword: 'moraa-admin-demo', seedDemo: true });
    expect(configFromEnv({ SEED_DEMO: 'false' }).seedDemo).toBe(false);
  });
});

describe('anúncios do anunciante', () => {
  it('validação devolve mapa de campos', async () => {
    const { agent } = await newUser(app);
    const res = await agent.post('/api/my/listings').send({
      title: 'curto', description: 'pouco', type: 'castelo', city: 'atlantida', neighborhood: '<b>x</b>', price: 5, bedrooms: 99,
      bathrooms: -1, parking: 1.5, areaM2: 2, features: ['teletransporte'], whatsapp: '123', whatsappAuthorized: true, ownershipDeclared: false,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf('string');
    expect(Object.keys(res.body.fields).sort()).toEqual(
      ['areaM2', 'bathrooms', 'bedrooms', 'city', 'description', 'features', 'neighborhood', 'ownershipDeclared', 'parking', 'price', 'title', 'type', 'whatsapp'].sort(),
    );
    for (const msg of Object.values(res.body.fields)) expect(msg).toBeTypeOf('string');

    const empty = await agent.post('/api/my/listings').send({});
    expect(empty.status).toBe(400);
    expect(empty.body.fields.title).toBeTypeOf('string');

    const html = await agent.post('/api/my/listings').send(input({ title: 'Casa <script>alert(1)</script> linda' }));
    expect(html.body.fields.title).toMatch(/HTML/);
    const desc = await agent.post('/api/my/listings').send(input({ description: 'Uma descrição com <img src=x onerror=alert(1)> escondida no meio.' }));
    expect(desc.body.fields.description).toMatch(/HTML/);
    const noPhone = await agent.post('/api/my/listings').send(input({ whatsapp: null }));
    expect(noPhone.body.fields.whatsapp).toBeTypeOf('string');
    expect((await agent.get('/api/my/listings')).body).toEqual([]);
  });

  it('saneia texto e aceita WhatsApp formatado', async () => {
    const { agent } = await newUser(app);
    const l = await createListing(agent, { title: '  Casa\u0000 com   varanda‮ grande ', whatsapp: '(62) 99988-7766', features: ['quintal', 'garagem', 'quintal'] });
    expect(l.title).toBe('Casa com varanda grande');
    expect(l.features).toEqual(['garagem', 'quintal']);
    expect(l.slug).toMatch(/^casa-com-varanda-grande-[0-9a-f]{6}$/);
    const full = await agent.get(`/api/my/listings/${l.id}`);
    expect(full.body.whatsapp).toBe(PHONE);
  });

  it('fluxo: criar → pendente → oculto → aprovar → público; pausar/reativar; editar volta a pendente', async () => {
    const { agent, email, user } = await newUser(app, 'Marina Lopes Pereira');
    const l = await createListing(agent);
    expect(l.status).toBe('pendente');
    expect(l.ownerId).toBe(user.id);
    expect(l).toMatchObject({ views: 0, contactClicks: 0, moderationNote: null, isDemo: false, featured: false, advertiserName: 'Marina' });
    expect(l).not.toHaveProperty('whatsapp');
    expect(l).not.toHaveProperty('ownerEmail');

    // Ainda não é público.
    expect((await request(app).get(`/api/listings/${l.slug}`)).status).toBe(404);
    expect((await request(app).get('/api/listings?q=flamboyant')).body.total).toBe(0);
    // Dono e admin enxergam.
    expect((await agent.get(`/api/listings/${l.slug}`)).status).toBe(200);
    expect((await admin.get(`/api/listings/${l.slug}`)).status).toBe(200);
    // Contato e denúncia não funcionam em anúncio não publicado.
    expect((await agentFor(app).post(`/api/listings/${l.id}/contact`)).status).toBe(404);

    const pend = await admin.get('/api/admin/listings?status=pendente');
    expect(pend.body.map((x: OwnedListing) => x.id)).toContain(l.id);
    expect(pend.body.find((x: OwnedListing) => x.id === l.id).ownerEmail).toBe(email);
    expect((await admin.get('/api/admin/listings')).body.length).toBeGreaterThanOrEqual(11);

    const ap = await moderate(admin, l.id, 'aprovar');
    expect(ap.status).toBe(200);
    expect(ap.body.status).toBe('ativo');

    const pub = await request(app).get(`/api/listings/${l.slug}`);
    expect(pub.status).toBe(200);
    expect(pub.body.whatsappAuthorized).toBe(true);
    expect((await request(app).get('/api/listings?q=flamboyant')).body.total).toBe(1);

    // Visualizações: contam para visitantes, não para dono/admin.
    await agent.get(`/api/listings/${l.slug}`);
    await admin.get(`/api/listings/${l.slug}`);
    const mine = (await agent.get('/api/my/listings')).body as OwnedListing[];
    expect(mine).toHaveLength(1);
    expect(mine[0].views).toBe(1);

    // Nenhuma resposta pública expõe telefone, e-mail ou dono.
    for (const url of ['/api/listings', `/api/listings/${l.slug}`, '/api/listings/featured', '/api/meta', '/api/listings?q=flamboyant', '/sitemap.xml']) {
      const text = (await request(app).get(url)).text;
      expect(text).not.toContain(PHONE);
      expect(text).not.toContain(email);
      expect(text).not.toContain(DEMO_USER_EMAIL);
      expect(text).not.toContain(ADMIN.email);
      expect(text).not.toMatch(/"whatsapp"|ownerId|ownerEmail|owner_|Lopes|Pereira/);
    }

    // Pausar e reativar (já aprovado → volta direto a ativo).
    const paused = await agent.post(`/api/my/listings/${l.id}/status`).send({ status: 'pausado' });
    expect(paused.body.status).toBe('pausado');
    expect((await request(app).get(`/api/listings/${l.slug}`)).status).toBe(404);
    expect((await agent.post(`/api/my/listings/${l.id}/status`).send({ status: 'pausado' })).status).toBe(409);
    const back = await agent.post(`/api/my/listings/${l.id}/status`).send({ status: 'ativo' });
    expect(back.body.status).toBe('ativo');
    expect((await agent.post(`/api/my/listings/${l.id}/status`).send({ status: 'rejeitado' })).status).toBe(400);

    // Editar → volta para moderação e some da busca.
    const edited = await agent.put(`/api/my/listings/${l.id}`).send(input({ price: 1700, title: 'Casa ampla reformada com três quartos' }));
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ status: 'pendente', price: 1700, slug: l.slug });
    expect((await request(app).get(`/api/listings/${l.slug}`)).status).toBe(404);
    expect((await agent.put(`/api/my/listings/${l.id}`).send(input({ price: 1 }))).status).toBe(400);

    // Pendente não pode ser "reativado" pelo dono (não burla a moderação).
    expect((await agent.post(`/api/my/listings/${l.id}/status`).send({ status: 'ativo' })).status).toBe(409);

    // Pausado + editado → reativar leva a pendente, não a ativo.
    await moderate(admin, l.id, 'aprovar');
    await agent.post(`/api/my/listings/${l.id}/status`).send({ status: 'pausado' });
    expect((await agent.put(`/api/my/listings/${l.id}`).send(input({ price: 1800 }))).body.status).toBe('pausado');
    expect((await agent.post(`/api/my/listings/${l.id}/status`).send({ status: 'ativo' })).body.status).toBe('pendente');

    // Pausa feita pela moderação não pode ser desfeita pelo dono.
    await moderate(admin, l.id, 'aprovar');
    expect((await moderate(admin, l.id, 'pausar', 'Em análise')).body.status).toBe('pausado');
    expect((await agent.post(`/api/my/listings/${l.id}/status`).send({ status: 'ativo' })).status).toBe(409);

    // Rejeitar exige justificativa; editar um rejeitado reenvia para moderação.
    const noNote = await moderate(admin, l.id, 'rejeitar');
    expect(noNote.status).toBe(400);
    expect(noNote.body.fields.note).toBeTypeOf('string');
    expect((await moderate(admin, l.id, 'rejeitar', '   ')).status).toBe(400);
    const rej = await moderate(admin, l.id, 'rejeitar', 'Fotos não correspondem ao imóvel.');
    expect(rej.body).toMatchObject({ status: 'rejeitado', moderationNote: 'Fotos não correspondem ao imóvel.' });
    expect((await agent.get('/api/my/listings')).body[0].moderationNote).toBe('Fotos não correspondem ao imóvel.');
    const resub = await agent.put(`/api/my/listings/${l.id}`).send(input());
    expect(resub.body).toMatchObject({ status: 'pendente', moderationNote: null });

    // Destaque.
    await moderate(admin, l.id, 'aprovar');
    expect((await moderate(admin, l.id, 'destacar')).body.featured).toBe(true);
    expect((await request(app).get('/api/listings/featured')).body.map((x: Listing) => x.id)).toContain(l.id);
    expect((await moderate(admin, l.id, 'remover-destaque')).body.featured).toBe(false);
    expect((await moderate(admin, l.id, 'explodir')).status).toBe(400);
    expect((await moderate(admin, 'nao-existe', 'aprovar')).status).toBe(404);

    // Cada ação administrativa gera linha de auditoria.
    const logs = getCtx(app).db.all<{ action: string }>("SELECT action FROM audit_log WHERE target_id = ?", l.id).map((x) => x.action);
    for (const a of ['listing.aprovar', 'listing.pausar', 'listing.rejeitar', 'listing.destacar', 'listing.remover-destaque']) expect(logs).toContain(a);

    // Excluir.
    expect((await agent.delete(`/api/my/listings/${l.id}`)).status).toBe(200);
    expect((await agent.get('/api/my/listings')).body).toEqual([]);
    expect((await request(app).get(`/api/listings/${l.slug}`)).status).toBe(404);
  });

  it('quem não é dono recebe 404', async () => {
    const owner = await newUser(app);
    const other = await newUser(app);
    const l = await createListing(owner.agent);
    expect((await other.agent.get(`/api/my/listings/${l.id}`)).status).toBe(404);
    expect((await other.agent.put(`/api/my/listings/${l.id}`).send(input({ price: 9999 }))).status).toBe(404);
    expect((await other.agent.post(`/api/my/listings/${l.id}/status`).send({ status: 'pausado' })).status).toBe(404);
    expect((await other.agent.post(`/api/my/listings/${l.id}/images`).attach('images', await png(64, 64), 'a.png')).status).toBe(404);
    expect((await other.agent.delete(`/api/my/listings/${l.id}/images/qualquer`)).status).toBe(404);
    expect((await other.agent.delete(`/api/my/listings/${l.id}`)).status).toBe(404);
    expect((await other.agent.get(`/api/listings/${l.slug}`)).status).toBe(404);
    // O admin também não edita pelo /my (usa as rotas de moderação).
    expect((await admin.get(`/api/my/listings/${l.id}`)).status).toBe(404);
    expect((await owner.agent.get(`/api/my/listings/${l.id}`)).body.price).toBe(1500);
    // Anúncios demonstrativos não pertencem a ninguém que consiga entrar.
    const demo = (await request(app).get('/api/listings')).body.items[0] as Listing;
    expect((await other.agent.put(`/api/my/listings/${demo.id}`).send(input())).status).toBe(404);
  });

  it('limite do plano gratuito: 3 anúncios não rejeitados', async () => {
    const { agent } = await newUser(app);
    const first = await createListing(agent);
    await createListing(agent);
    await createListing(agent);
    const fourth = await agent.post('/api/my/listings').send(input());
    expect(fourth.status).toBe(409);
    expect(fourth.body.error).toMatch(/até 3 anúncios/);
    // Rejeitado não conta.
    await moderate(admin, first.id, 'rejeitar', 'Dados incompletos.');
    expect((await agent.post('/api/my/listings').send(input())).status).toBe(201);
    expect((await agent.post('/api/my/listings').send(input())).status).toBe(409);
  });

  it('admin pode excluir anúncio', async () => {
    const { agent } = await newUser(app);
    const l = await createListing(agent);
    expect((await admin.delete(`/api/admin/listings/${l.id}`)).status).toBe(200);
    expect((await agent.get('/api/my/listings')).body).toEqual([]);
    expect((await admin.delete(`/api/admin/listings/${l.id}`)).status).toBe(404);
    expect(getCtx(app).db.get("SELECT 1 AS ok FROM audit_log WHERE action = 'listing.excluir' AND target_id = ?", l.id)).toBeTruthy();
  });
});

describe('contato', () => {
  it('demo → kind demo, nunca telefone', async () => {
    const demo = (await request(app).get('/api/listings')).body.items[0] as Listing;
    const res = await agentFor(app).post(`/api/listings/${demo.id}/contact`);
    expect(res.status).toBe(200);
    expect(res.body.kind).toBe('demo');
    expect(res.body.whatsappUrl).toBeUndefined();
    expect(res.text).not.toMatch(/wa\.me|\d{10,}/);
  });

  it('demo nunca devolve telefone, mesmo com dados adulterados no banco', async () => {
    const other = makeApp();
    getCtx(other).db.run('UPDATE listings SET whatsapp = ?, whatsapp_authorized = 1', PHONE);
    const list = await request(other).get('/api/listings');
    expect(list.text).not.toContain(PHONE);
    expect(list.body.items.every((l: Listing) => l.whatsappAuthorized === false)).toBe(true);
    const res = await agentFor(other).post(`/api/listings/${list.body.items[0].id}/contact`);
    expect(res.body.kind).toBe('demo');
    expect(res.text).not.toContain(PHONE);
  });

  it('real autorizado → URL wa.me; não autorizado → indisponível; conta cliques', async () => {
    const { agent } = await newUser(app);
    const yes = await createListing(agent, { title: 'Sobrado "Sol & Lua" com 3 quartos' });
    const no = await createListing(agent, { whatsappAuthorized: false });
    await moderate(admin, yes.id, 'aprovar');
    await moderate(admin, no.id, 'aprovar');

    const visitor = agentFor(app);
    const r1 = await visitor.post(`/api/listings/${yes.id}/contact`);
    expect(r1.status).toBe(200);
    expect(r1.body.kind).toBe('whatsapp');
    const url = new URL(r1.body.whatsappUrl);
    expect(url.origin + url.pathname).toBe(`https://wa.me/55${PHONE}`);
    expect(url.searchParams.get('text')).toContain('Sobrado "Sol & Lua" com 3 quartos');
    expect(r1.body.whatsappUrl).toContain('?text=');
    expect(r1.body.whatsappUrl).not.toMatch(/[ "]/);

    const r2 = await visitor.post(`/api/listings/${no.id}/contact`);
    expect(r2.body.kind).toBe('indisponivel');
    expect(r2.text).not.toContain(PHONE);
    expect(r2.body.whatsappUrl).toBeUndefined();

    await visitor.post(`/api/listings/${yes.id}/contact`);
    const mine = (await agent.get('/api/my/listings')).body as OwnedListing[];
    expect(mine.find((l) => l.id === yes.id)!.contactClicks).toBe(2);
    expect((await visitor.post('/api/listings/nao-existe/contact')).status).toBe(404);
    expect((await request(app).get(`/api/listings/${no.slug}`)).body.whatsappAuthorized).toBe(false);
  });
});

describe('denúncias', () => {
  it('criar (sem login) e resolver (admin)', async () => {
    const demo = (await request(app).get('/api/listings')).body.items[1] as Listing;
    const visitor = agentFor(app);
    expect((await visitor.post(`/api/listings/${demo.id}/report`).send({ reason: 'porque-sim', details: '' })).status).toBe(400);
    expect((await visitor.post(`/api/listings/${demo.id}/report`).send({ reason: 'golpe', details: 'x'.repeat(1001) })).status).toBe(400);
    expect((await visitor.post('/api/listings/nao-existe/report').send({ reason: 'golpe', details: '' })).status).toBe(404);
    const created = await visitor.post(`/api/listings/${demo.id}/report`).send({ reason: 'golpe', details: '  Pediu depósito antecipado.\u0007 ' });
    expect(created.status).toBe(201);

    expect((await agentFor(app).get('/api/admin/reports')).status).toBe(401);
    const open = await admin.get('/api/admin/reports?status=aberta');
    expect(open.status).toBe(200);
    const rep = open.body.find((r: { listingId: string }) => r.listingId === demo.id);
    expect(rep).toMatchObject({
      listingTitle: demo.title, listingSlug: demo.slug, reason: 'golpe', details: 'Pediu depósito antecipado.', status: 'aberta', resolution: null,
    });
    expect((await admin.get('/api/admin/metrics')).body.openReports).toBeGreaterThanOrEqual(1);

    expect((await admin.post(`/api/admin/reports/${rep.id}/resolve`).send({ resolution: '' })).status).toBe(400);
    expect((await admin.post('/api/admin/reports/nao-existe/resolve').send({ resolution: 'Verificado.' })).status).toBe(404);
    const done = await admin.post(`/api/admin/reports/${rep.id}/resolve`).send({ resolution: 'Anúncio verificado; sem irregularidade.' });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ id: rep.id, status: 'resolvida', resolution: 'Anúncio verificado; sem irregularidade.' });
    expect((await admin.get('/api/admin/reports?status=aberta')).body.find((r: { id: string }) => r.id === rep.id)).toBeUndefined();
    expect((await admin.get('/api/admin/reports?status=resolvida')).body.map((r: { id: string }) => r.id)).toContain(rep.id);
    expect(getCtx(app).db.get("SELECT 1 AS ok FROM audit_log WHERE action = 'report.resolver' AND target_id = ?", rep.id)).toBeTruthy();
  });
});

describe('imagens', () => {
  const uploads = () => path.join(getCtx(app).uploadsDir);

  it('PNG válido é aceito e regravado em WebP (1280/640)', async () => {
    const { agent } = await newUser(app);
    const l = await createListing(agent);
    const res = await agent.post(`/api/my/listings/${l.id}/images`).attach('images', await png(), { filename: '../../etc/passwd.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.images).toHaveLength(1);
    const img = res.body.images[0];
    expect(img.url).toMatch(/^\/uploads\/[0-9a-f]{32}\.webp$/);
    expect(img.thumbUrl).toMatch(/^\/uploads\/[0-9a-f]{32}-640\.webp$/);
    expect(img.alt).toBeTypeOf('string');

    const full = await sharp(path.join(uploads(), path.basename(img.url))).metadata();
    const thumb = await sharp(path.join(uploads(), path.basename(img.thumbUrl))).metadata();
    expect(full.format).toBe('webp');
    expect(full.width).toBe(1280);
    expect(thumb.format).toBe('webp');
    expect(thumb.width).toBe(640);

    const served = await request(app).get(img.url);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/webp');
    expect(served.headers['x-content-type-options']).toBe('nosniff');
    expect(served.headers['cache-control']).toMatch(/max-age=31536000/);
    expect(served.headers['cache-control']).toMatch(/immutable/);
    // Sem listagem de diretório nem travessia de caminho.
    expect((await request(app).get('/uploads/')).status).toBe(404);
    expect((await request(app).get('/uploads/..%2Fmoraa.sqlite')).status).toBeGreaterThanOrEqual(400);
    expect((await request(app).get('/uploads/%2e%2e/moraa.sqlite')).status).toBeGreaterThanOrEqual(400);

    // Remover imagem apaga também os arquivos.
    expect((await agent.delete(`/api/my/listings/${l.id}/images/nao-existe`)).status).toBe(404);
    const del = await agent.delete(`/api/my/listings/${l.id}/images/${img.id}`);
    expect(del.status).toBe(200);
    expect(del.body.images).toEqual([]);
    expect(fs.existsSync(path.join(uploads(), path.basename(img.url)))).toBe(false);
    expect(fs.existsSync(path.join(uploads(), path.basename(img.thumbUrl)))).toBe(false);
    expect((await request(app).get(img.url)).status).toBe(404);
  });

  it('imagem pequena não é ampliada; JPEG e WebP também são aceitos', async () => {
    const { agent } = await newUser(app);
    const l = await createListing(agent);
    const small = sharp({ create: { width: 300, height: 200, channels: 3, background: '#336699' } });
    const res = await agent
      .post(`/api/my/listings/${l.id}/images`)
      .attach('images', await small.clone().jpeg().toBuffer(), 'a.jpg')
      .attach('images', await small.clone().webp().toBuffer(), 'b.webp');
    expect(res.status).toBe(201);
    expect(res.body.images).toHaveLength(2);
    const meta = await sharp(path.join(uploads(), path.basename(res.body.images[0].url))).metadata();
    expect(meta.width).toBe(300);
  });

  it('rejeita o que não é imagem de verdade', async () => {
    const { agent } = await newUser(app);
    const l = await createListing(agent);
    const before = fs.readdirSync(uploads()).length;
    const send = (buf: Buffer, filename: string, contentType: string) =>
      agent.post(`/api/my/listings/${l.id}/images`).attach('images', buf, { filename, contentType });

    const txt = await send(Buffer.from('isto é só um texto renomeado, não uma foto de verdade'), 'foto.jpg', 'image/jpeg');
    expect(txt.status).toBe(400);
    expect(txt.body.error).toMatch(/JPEG, PNG ou WebP/);
    // Bytes mágicos de JPEG seguidos de lixo: passa no sniff, falha na decodificação.
    const fake = await send(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, 7)]), 'foto.jpg', 'image/jpeg');
    expect(fake.status).toBe(400);
    const svg = await send(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), 'x.svg', 'image/svg+xml');
    expect(svg.status).toBe(400);
    const gif = await send(await sharp({ create: { width: 20, height: 20, channels: 3, background: '#fff' } }).gif().toBuffer(), 'x.png', 'image/png');
    expect(gif.status).toBe(400);
    const html = await send(Buffer.from('<!doctype html><script>alert(1)</script>'), 'x.webp', 'image/webp');
    expect(html.status).toBe(400);
    // Lote com um arquivo inválido é rejeitado por inteiro, sem deixar restos.
    const mixed = await agent.post(`/api/my/listings/${l.id}/images`).attach('images', await png(100, 100), 'ok.png').attach('images', Buffer.from('nada aqui, só texto puro'), 'x.png');
    expect(mixed.status).toBe(400);
    // Campo errado e ausência de arquivo.
    expect((await agent.post(`/api/my/listings/${l.id}/images`).attach('arquivo', await png(50, 50), 'a.png')).status).toBe(400);
    expect((await agent.post(`/api/my/listings/${l.id}/images`).field('x', '1')).status).toBe(400);
    // Acima de 6 MB.
    const huge = await send(Buffer.concat([await png(50, 50), Buffer.alloc(6 * 1024 * 1024 + 10)]), 'grande.png', 'image/png');
    expect(huge.status).toBe(400);
    expect(huge.body.error).toMatch(/6 MB/);

    expect((await agent.get(`/api/my/listings/${l.id}`)).body.images).toEqual([]);
    expect(fs.readdirSync(uploads()).length).toBe(before);
    expect(sniffImage(Buffer.from('GIF89a..........'))).toBeNull();
  });

  it('remove EXIF/GPS e aplica a orientação', async () => {
    const { agent } = await newUser(app);
    const l = await createListing(agent);
    const jpeg = await sharp({ create: { width: 400, height: 200, channels: 3, background: '#884422' } })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .withExif({
        IFD0: { Copyright: 'Segredo-do-Autor', Make: 'CameraSecreta' },
        IFD3: { GPSLatitudeRef: 'S', GPSLatitude: '16/1 42/1 30/1', GPSLongitudeRef: 'W', GPSLongitude: '49/1 5/1 30/1' },
      })
      .toBuffer();
    const inMeta = await sharp(jpeg).metadata();
    expect(inMeta.exif).toBeDefined();
    expect(inMeta.orientation).toBe(6);
    expect(jpeg.includes('Segredo-do-Autor')).toBe(true);

    const res = await agent.post(`/api/my/listings/${l.id}/images`).attach('images', jpeg, 'foto.jpg');
    expect(res.status).toBe(201);
    for (const u of [res.body.images[0].url, res.body.images[0].thumbUrl]) {
      const file = fs.readFileSync(path.join(uploads(), path.basename(u)));
      const meta = await sharp(file).metadata();
      expect(meta.format).toBe('webp');
      expect(meta.exif).toBeUndefined();
      expect(meta.xmp).toBeUndefined();
      expect(meta.iptc).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
      expect(file.includes('Segredo-do-Autor')).toBe(false);
      expect(file.includes('CameraSecreta')).toBe(false);
      expect(file.includes('EXIF')).toBe(false);
    }
    // Orientation 6 = girar 90°: 400x200 vira 200x400.
    const out = await sharp(path.join(uploads(), path.basename(res.body.images[0].url))).metadata();
    expect([out.width, out.height]).toEqual([200, 400]);
  });

  it('máximo de 8 imagens: a 9ª é rejeitada', async () => {
    const { agent } = await newUser(app);
    const l = await createListing(agent);
    const tiny = await png(40, 30);
    let req = agent.post(`/api/my/listings/${l.id}/images`);
    for (let i = 0; i < 5; i++) req = req.attach('images', tiny, `f${i}.png`);
    expect((await req).status).toBe(201);
    // 5 + 4 passaria do limite → rejeita o lote todo.
    let over = agent.post(`/api/my/listings/${l.id}/images`);
    for (let i = 0; i < 4; i++) over = over.attach('images', tiny, `g${i}.png`);
    expect((await over).status).toBe(400);
    let fill = agent.post(`/api/my/listings/${l.id}/images`);
    for (let i = 0; i < 3; i++) fill = fill.attach('images', tiny, `h${i}.png`);
    const full = await fill;
    expect(full.status).toBe(201);
    expect(full.body.images).toHaveLength(8);
    const ninth = await agent.post(`/api/my/listings/${l.id}/images`).attach('images', tiny, 'nona.png');
    expect(ninth.status).toBe(400);
    expect(ninth.body.error).toMatch(/8 fotos/);
    expect((await agent.get(`/api/my/listings/${l.id}`)).body.images).toHaveLength(8);
    // Mais de 8 arquivos em uma única requisição.
    const { agent: a2 } = await newUser(app);
    const l2 = await createListing(a2);
    let many = a2.post(`/api/my/listings/${l2.id}/images`);
    for (let i = 0; i < 9; i++) many = many.attach('images', tiny, `m${i}.png`);
    expect((await many).status).toBe(400);
  });

  it('fotos novas em anúncio ativo voltam para moderação', async () => {
    const { agent } = await newUser(app);
    const l = await createListing(agent);
    await moderate(admin, l.id, 'aprovar');
    const res = await agent.post(`/api/my/listings/${l.id}/images`).attach('images', await png(60, 60), 'a.png');
    expect(res.body.status).toBe('pendente');
  });

  it('upload exige login e cabeçalho CSRF', async () => {
    const demo = (await request(app).get('/api/listings')).body.items[0] as Listing;
    expect((await agentFor(app).post(`/api/my/listings/${demo.id}/images`).attach('images', await png(40, 40), 'a.png')).status).toBe(401);
    expect((await request(app).post(`/api/my/listings/${demo.id}/images`).attach('images', await png(40, 40), 'a.png')).status).toBe(403);
  });
});

describe('planos e métricas', () => {
  it('interesse em plano incrementa contador agregado', async () => {
    const before = (await admin.get('/api/admin/metrics')).body.planInterest;
    const v = agentFor(app);
    expect((await v.post('/api/plans/interest').send({ plan: 'destaque-7' })).status).toBe(201);
    expect((await v.post('/api/plans/interest').send({ plan: 'destaque-7' })).status).toBe(201);
    expect((await v.post('/api/plans/interest').send({ plan: 'imobiliaria' })).status).toBe(201);
    expect((await v.post('/api/plans/interest').send({ plan: 'ouro' })).status).toBe(400);
    expect((await v.post('/api/plans/interest').send({})).status).toBe(400);
    const after = (await admin.get('/api/admin/metrics')).body.planInterest;
    expect(after['destaque-7'] - before['destaque-7']).toBe(2);
    expect(after.imobiliaria - before.imobiliaria).toBe(1);
    expect(after.basico).toBe(before.basico);
  });

  it('formato das métricas', async () => {
    const res = await admin.get('/api/admin/metrics');
    expect(res.status).toBe(200);
    const m = res.body;
    expect(Object.keys(m).sort()).toEqual(
      ['byCity', 'demoListings', 'listings', 'openReports', 'planInterest', 'totalContactClicks', 'totalViews', 'users'].sort(),
    );
    expect(Object.keys(m.listings).sort()).toEqual(['ativo', 'pausado', 'pendente', 'rejeitado']);
    expect(m.demoListings).toBe(10);
    expect(m.listings.ativo).toBeGreaterThanOrEqual(10);
    expect(Object.keys(m.planInterest).sort()).toEqual(['basico', 'destaque-30', 'destaque-7', 'imobiliaria']);
    expect(Object.keys(m.byCity)).toEqual(CITIES.map((c) => c.id));
    for (const k of ['users', 'openReports', 'totalViews', 'totalContactClicks']) expect(m[k]).toBeTypeOf('number');
    expect(m.users).toBeGreaterThan(0);
    const total = Object.values(m.listings as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(Object.values(m.byCity as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(total);
  });
});

describe('exclusão de conta (LGPD)', () => {
  it('remove conta, sessões, anúncios e arquivos de imagem', async () => {
    const { agent, email, user } = await newUser(app);
    const l = await createListing(agent);
    const up = await agent.post(`/api/my/listings/${l.id}/images`).attach('images', await png(80, 80), 'a.png');
    const file = path.join(getCtx(app).uploadsDir, path.basename(up.body.images[0].url));
    expect(fs.existsSync(file)).toBe(true);
    await moderate(admin, l.id, 'aprovar');
    await agentFor(app).post(`/api/listings/${l.id}/report`).send({ reason: 'outro', details: '' });

    expect((await request(app).delete('/api/auth/account').set('X-Requested-With', 'moraa')).status).toBe(401);
    const del = await agent.delete('/api/auth/account');
    expect(del.status).toBe(200);
    expect(String(del.headers['set-cookie'])).toMatch(/moraa_sid=;.*Max-Age=0/);

    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
    expect((await request(app).get(`/api/listings/${l.slug}`)).status).toBe(404);
    expect(fs.existsSync(file)).toBe(false);
    const db = getCtx(app).db;
    expect(db.get('SELECT 1 AS ok FROM users WHERE id = ?', user.id)).toBeUndefined();
    expect(db.get('SELECT 1 AS ok FROM sessions WHERE user_id = ?', user.id)).toBeUndefined();
    expect(db.get('SELECT 1 AS ok FROM listings WHERE owner_id = ?', user.id)).toBeUndefined();
    expect(db.get('SELECT 1 AS ok FROM images WHERE listing_id = ?', l.id)).toBeUndefined();
    expect(db.get('SELECT 1 AS ok FROM reports WHERE listing_id = ?', l.id)).toBeUndefined();
    expect((await agentFor(app).post('/api/auth/login').send({ email, password: 'senha-bem-longa-1' })).status).toBe(401);
  });

  it('a conta admin não pode se autoexcluir', async () => {
    const res = await admin.delete('/api/auth/account');
    expect(res.status).toBe(403);
    expect((await admin.get('/api/auth/me')).body.user.role).toBe('admin');
  });
});

describe('SPA, metadados de compartilhamento e SEO', () => {
  const INDEX = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <title>MORAA GO</title>
    <meta name="description" content="padrão">
    <meta property="og:title" content="MORAA GO">
    <meta property="og:image" content="/img/og.jpg">
    <script type="module" src="/assets/app-abc123.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>`;

  it('injectMeta escapa HTML e substitui as tags existentes', () => {
    const out = injectMeta(INDEX, {
      title: `</title><script>alert("x")</script> & 'cia' $& $1`,
      description: `"><img src=x onerror=alert(1)>`,
      url: 'https://moraago.example/imovel/a"b',
      image: 'https://moraago.example/uploads/a.webp',
    });
    expect(out).not.toContain('<script>alert');
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;/title&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;cia&#39; $&amp; $1');
    expect(out).toContain('content="&quot;&gt;&lt;img src=x onerror=alert(1)&gt;"');
    expect(out).toContain('a&quot;b');
    expect(out.match(/<title>/g)).toHaveLength(1);
    expect(out.match(/og:title/g)).toHaveLength(1);
    expect(out.match(/og:image/g)).toHaveLength(1);
    expect(out.match(/name="description"/g)).toHaveLength(1);
    expect(out).toContain('<script type="module" src="/assets/app-abc123.js"></script>');
    expect(out.indexOf('og:title')).toBeLessThan(out.indexOf('</head>'));
  });

  it('serve dist com cache correto, fallback do SPA e metatags por anúncio', async () => {
    const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'moraa-dist-'));
    tmpDirs.push(dist);
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'index.html'), INDEX);
    fs.writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
    fs.writeFileSync(path.join(dist, 'sw.js'), '// sw');
    fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), '{}');
    const spa = makeApp({ distDir: dist });
    const adm = await adminAgent(spa);
    const { agent } = await newUser(spa);
    const l = await createListing(agent, { title: `Casa "Bela Vista" & Cia com quintal`, description: `Linda casa com "aspas" & 'apóstrofos' para testar o escape correto.` });
    const up = await agent.post(`/api/my/listings/${l.id}/images`).attach('images', await png(100, 80), 'a.png');

    // Pendente: página existe (SPA), mas sem metadados do anúncio.
    const hidden = await request(spa).get(`/imovel/${l.slug}`);
    expect(hidden.status).toBe(200);
    expect(hidden.text).toContain('<title>MORAA GO</title>');
    expect(hidden.text).not.toContain('Bela Vista');

    await moderate(adm, l.id, 'aprovar');
    const page = await request(spa).get(`/imovel/${l.slug}`);
    expect(page.status).toBe(200);
    expect(page.headers['content-type']).toMatch(/text\/html/);
    expect(page.headers['cache-control']).toBe('no-cache');
    expect(page.headers['content-security-policy']).toContain("default-src 'self'");
    expect(page.text).toContain('<title>Casa &quot;Bela Vista&quot; &amp; Cia com quintal — MORAA GO</title>');
    expect(page.text).toContain('<meta property="og:title" content="Casa &quot;Bela Vista&quot; &amp; Cia com quintal — MORAA GO">');
    expect(page.text).not.toContain('"Bela Vista"');
    expect(page.text).toMatch(/og:description" content="Casa para alugar em Jardim Flamboyant, Senador Canedo — R\$\s1\.500\/mês\. Linda casa com &quot;aspas&quot; &amp; &#39;apóstrofos&#39;/);
    expect(page.text).toContain(`<meta property="og:image" content="https://moraago.example${up.body.images[0].url}">`);
    expect(page.text).toContain(`<meta property="og:url" content="https://moraago.example/imovel/${l.slug}">`);
    expect(page.text).not.toContain(PHONE);
    expect(page.text).toContain('<div id="root"></div>');

    const demo = (await request(spa).get('/api/listings')).body.items[0] as Listing;
    const demoPage = await request(spa).get(`/imovel/${demo.slug}`);
    expect(demoPage.text).toContain('[Demonstração]');
    expect(demoPage.text).toContain(`content="https://moraago.example${demo.images[0].url}"`);

    // Fallback do SPA e cabeçalhos de cache.
    for (const url of ['/', '/imoveis', '/minha-conta/anuncio/123', '/imovel/nao-existe', '/imovel/%E0%A4%A']) {
      const res = await request(spa).get(url);
      expect(res.status).toBe(200);
      expect(res.text).toContain('<title>MORAA GO</title>');
      expect(res.headers['cache-control']).toBe('no-cache');
    }
    const asset = await request(spa).get('/assets/app-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect((await request(spa).get('/sw.js')).headers['cache-control']).toBe('no-cache');
    expect((await request(spa).get('/manifest.webmanifest')).headers['cache-control']).toBe('no-cache');
    // Não cai no SPA: API, uploads, arquivos inexistentes e métodos de escrita.
    expect((await request(spa).get('/api/nao-existe')).headers['content-type']).toMatch(/json/);
    expect((await request(spa).get('/api/nao-existe')).status).toBe(404);
    expect((await request(spa).get('/uploads/nao-existe.webp')).status).toBe(404);
    expect((await request(spa).get('/assets/sumiu.js')).status).toBe(404);
    expect((await request(spa).post('/imoveis')).status).toBe(404);
  });

  it('sitemap.xml e robots.txt', async () => {
    const map = await request(app).get('/sitemap.xml');
    expect(map.status).toBe(200);
    expect(map.headers['content-type']).toMatch(/xml/);
    expect(map.text).toContain('<loc>https://moraago.example/</loc>');
    expect(map.text).toContain('<loc>https://moraago.example/imoveis</loc>');
    expect(map.text.match(/\/imovel\//g)!.length).toBeGreaterThanOrEqual(10);
    const pend = getCtx(app).db.all<{ slug: string }>("SELECT slug FROM listings WHERE status <> 'ativo'");
    expect(pend.length).toBeGreaterThan(0);
    for (const p of pend) expect(map.text).not.toContain(p.slug);
    const robots = await request(app).get('/robots.txt');
    expect(robots.status).toBe(200);
    expect(robots.text).toContain('Disallow: /api/');
    expect(robots.text).toContain('Sitemap: https://moraago.example/sitemap.xml');
  });

  it('sem dist: rotas que não são da API respondem 404', async () => {
    expect((await request(app).get('/imoveis')).status).toBe(404);
  });
});
