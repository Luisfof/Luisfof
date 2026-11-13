// Gera capturas REAIS da aplicação (build de produção servido pela própria API).
// Uso: npm run build && npm run capturas            → docs/capturas/
//      node scripts/capturas.mjs --out pasta --only home
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = arg('--out', 'docs/capturas');
const ONLY = arg('--only', '');
const PORT = 8791;
const BASE = `http://localhost:${PORT}`;
const dataDir = await mkdtemp(path.join(tmpdir(), 'moraa-cap-'));
await mkdir(OUT, { recursive: true });

const srv = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, NODE_ENV: 'development', ADMIN_PASSWORD: '', SEED_DEMO: 'true' },
  stdio: 'ignore',
});
const stop = async () => { srv.kill(); await rm(dataDir, { recursive: true, force: true }); };
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`${BASE}/api/health`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
  const browser = await chromium.launch();
  const VP = { m360: [360, 780], m390: [390, 844], t768: [768, 1024], d1440: [1440, 900] };
  const ctxFor = async (k, storage) => {
    const [width, height] = VP[k];
    const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: k === 'd1440' ? 1 : 2, isMobile: width < 700, hasTouch: width < 1000, locale: 'pt-BR', storageState: storage });
    await ctx.addInitScript(() => { try { localStorage.setItem('moraa-consent', '1'); } catch {} });
    return ctx;
  };
  const shot = async (page, name, { full = true, fold = true } = {}) => {
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(500);
    if (fold) await page.screenshot({ path: `${OUT}/${name}-dobra.png` });
    if (full) {
      // rola a página para disparar o carregamento das imagens lazy antes da captura inteira
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 80)); } scrollTo(0, 0); });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${OUT}/${name}-inteira.png`, fullPage: true });
    }
    console.log('✓', name);
  };
  const want = (n) => !ONLY || n.includes(ONLY);

  // Contas e dados de apoio (anunciante com anúncio pendente + denúncia)
  const api = async (ctx, p, body, method = 'POST') => (await ctx.request.fetch(`${BASE}/api${p}`, { method, data: body, headers: { 'X-Requested-With': 'moraa' } }));
  const adv = await ctxFor('m360');
  await api(adv, '/auth/register', { name: 'Marina Alves (teste)', email: 'anunciante@teste.local', password: 'senha-de-teste-123', acceptTerms: true });
  await api(adv, '/my/listings', { title: 'Casa de teste com varanda e quintal', description: 'Anúncio criado automaticamente pelo roteiro de capturas para demonstrar a fila de moderação.', type: 'casa', city: 'senador-canedo', neighborhood: 'Jardim Canedo', price: 1500, bedrooms: 2, bathrooms: 1, parking: 1, areaM2: 90, features: ['quintal', 'garagem'], whatsappAuthorized: false, ownershipDeclared: true });
  const list = await (await adv.request.get(`${BASE}/api/listings`)).json();
  const first = list.items[0];
  await api(adv, `/listings/${list.items[2].id}/report`, { reason: 'dados-incorretos', details: 'Denúncia de teste gerada pelo roteiro de capturas.' });
  const advState = await adv.storageState();
  const adm = await ctxFor('d1440');
  await api(adm, '/auth/login', { email: 'admin@moraago.local', password: 'moraa-admin-demo' });
  const admState = await adm.storageState();
  await adv.close(); await adm.close();

  for (const k of Object.keys(VP)) {
    const ctx = await ctxFor(k);
    const page = await ctx.newPage();
    if (want('home')) { await page.goto(BASE + '/'); await page.waitForSelector('.card'); await shot(page, `home-${k}`); }
    if (want('busca')) {
      await page.goto(BASE + '/imoveis?city=senador-canedo&features=garagem'); await page.waitForSelector('.card'); await shot(page, `busca-${k}`, { fold: false });
      if (k === 'm360') { await page.click('.toolbar__filter'); await page.waitForSelector('.sheet__panel'); await page.waitForTimeout(400); await page.screenshot({ path: `${OUT}/busca-filtros-${k}.png` }); console.log('✓ filtros'); }
      if (k === 'm390') { await page.goto(BASE + '/imoveis?city=trindade&maxPrice=800'); await page.waitForSelector('.state'); await shot(page, `busca-vazia-${k}`, { full: false }); }
    }
    if (want('detalhe')) { await page.goto(`${BASE}/imovel/${first.slug}`); await page.waitForSelector('.gal'); await shot(page, `detalhe-${k}`, { fold: k !== 't768' }); }
    if (want('planos') && (k === 'm360' || k === 'd1440')) { await page.goto(BASE + '/planos'); await page.waitForSelector('.plan'); await shot(page, `planos-${k}`, { fold: false }); }
    if (want('legal') && k === 'm390') { await page.goto(BASE + '/privacidade'); await shot(page, `privacidade-${k}`, { full: false }); await page.goto(BASE + '/pagina-inexistente'); await shot(page, `404-${k}`, { full: false }); }
    if (want('entrar') && (k === 'm360' || k === 'd1440')) { await page.goto(BASE + '/entrar?modo=criar'); await page.waitForSelector('.form'); await shot(page, `entrar-${k}`, { full: false }); }
    await ctx.close();

    if (want('form') || want('conta')) {
      const c2 = await ctxFor(k, advState); const p2 = await c2.newPage();
      if (want('form')) {
        await p2.goto(BASE + '/anunciar'); await p2.waitForSelector('.pform'); await shot(p2, `formulario-${k}`, { fold: false });
        if (k === 'm360') { await p2.click('.pform__end .btn'); await p2.waitForSelector('.err'); await p2.evaluate(() => scrollTo(0, 0)); await p2.waitForTimeout(500); await p2.screenshot({ path: `${OUT}/formulario-validacao-${k}.png`, fullPage: true }); console.log('✓ validação'); }
      }
      if (want('conta') && (k === 'm360' || k === 'd1440')) { await p2.goto(BASE + '/minha-conta'); await p2.waitForSelector('.orow'); await shot(p2, `anunciante-${k}`, { fold: false }); }
      await c2.close();
    }
    if (want('admin') && k !== 'm390') {
      const c3 = await ctxFor(k, admState); const p3 = await c3.newPage();
      await p3.goto(BASE + '/admin'); await p3.waitForSelector('.orow, .state'); await shot(p3, `admin-${k}`, { fold: false });
      if (k === 'd1440') { await p3.click('[role=tab]:has-text("Denúncias")'); await p3.waitForSelector('.orow--report'); await shot(p3, `admin-denuncias-${k}`, { fold: false }); }
      await c3.close();
    }
  }
  await browser.close();
} finally { await stop(); }
