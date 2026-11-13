import { expect, test } from '@playwright/test';
import sharp from 'sharp';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('moraa-consent', '1'));
});

test('home: busca do hero leva aos resultados filtrados', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/Abra a\s*porta\s*certa/i);
  await expect(page.locator('.card').first()).toBeVisible();
  await expect(page.locator('.card .tag--demo').first()).toHaveText(/Demonstrativo/i);
  await page.getByLabel('Onde').selectOption('goiania');
  await page.getByRole('button', { name: /Buscar imóveis/i }).click();
  await expect(page).toHaveURL(/imoveis\?city=goiania/);
  await expect(page.locator('.toolbar__count')).toContainText('4');
  await expect(page.locator('.card')).toHaveCount(4);
});

test('busca: filtros, ordenação e estado vazio', async ({ page }) => {
  await page.goto('/imoveis');
  await expect(page.locator('.toolbar__count')).toContainText('10');
  await page.getByLabel('Cidade').selectOption('senador-canedo');
  await expect(page.locator('.toolbar__count')).toContainText('5');
  await page.locator('.results__side').getByLabel('Aceita pet').click();
  await expect(page.locator('.toolbar__count')).toContainText('3');
  await page.getByLabel('Ordenar por').selectOption('menor-preco');
  await expect(page.locator('.card__price strong').first()).toHaveText(/1\.200/);
  await page.getByLabel('Aluguel máximo').selectOption('800');
  await expect(page.getByText('Nada por aqui')).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.locator('.toolbar__count')).toContainText('10');
});

test('detalhe demonstrativo: sem telefone, contato simulado e denúncia', async ({ page }) => {
  await page.goto('/imoveis');
  await page.locator('.card__link').first().click();
  await expect(page.locator('.detail__title')).toBeVisible();
  await expect(page.getByText('Anúncio demonstrativo.').first()).toBeVisible();
  expect(await page.content()).not.toMatch(/wa\.me|\(62\) 9/);
  await page.locator('.buy').getByRole('button', { name: /Simular contato/i }).click();
  await expect(page.locator('.buy .notice--ok')).toBeVisible();
  await page.getByRole('button', { name: /Denunciar este anúncio/i }).click();
  await page.getByLabel('Motivo da denúncia').selectOption('dados-incorretos');
  await page.getByRole('button', { name: 'Enviar denúncia' }).click();
  await expect(page.getByText('Denúncia enviada')).toBeVisible();
});

test('fluxo completo: cadastro → anúncio com foto → moderação → público → pausa', async ({ page, browser }) => {
  const email = `e2e-${Date.now()}@teste.local`;
  const title = `Casa E2E ${Date.now()}`;
  // rota protegida redireciona para login
  await page.goto('/anunciar');
  await expect(page).toHaveURL(/entrar\?next=/);
  await page.getByRole('tab', { name: 'Criar conta' }).click();
  await page.getByRole('button', { name: /Criar conta/ }).click();
  await expect(page.getByText('Use pelo menos 10 caracteres.')).toBeVisible();
  await page.getByLabel('Nome').fill('Pessoa de Teste');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill('senha-bem-longa-1');
  await page.locator('.check input').check();
  await page.getByRole('button', { name: /Criar conta/ }).click();
  await expect(page).toHaveURL(/anunciar/);

  // validação do formulário
  await page.getByRole('button', { name: /Enviar para moderação/ }).click();
  await expect(page.getByText('Revise os campos destacados.')).toBeVisible();
  await page.getByRole('radio', { name: 'Casa' }).check();
  await page.getByLabel('Título do anúncio').fill(title);
  await page.getByLabel('Descrição').fill('Casa criada pelo teste automatizado de ponta a ponta, com dois quartos e quintal.');
  await page.getByLabel('Cidade').selectOption('senador-canedo');
  await page.getByLabel('Bairro').fill('Bairro E2E');
  await page.getByLabel('Aluguel (R$)').fill('1234');
  const png = await sharp({ create: { width: 900, height: 600, channels: 3, background: '#c96' } }).png().toBuffer();
  await page.locator('input[type=file]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: png });
  await expect(page.locator('.thumbs img')).toHaveCount(1);
  await page.getByLabel(/Autorizo exibir meu WhatsApp/).check();
  await page.getByLabel('WhatsApp com DDD').fill('62900000000');
  await page.getByLabel(/Declaro que sou proprietário/).check();
  await page.getByRole('button', { name: /Enviar para moderação/ }).click();
  await expect(page).toHaveURL(/minha-conta$/);
  await expect(page.locator('.orow', { hasText: title }).locator('.tag--pendente')).toBeVisible();
  await expect(page.locator('.orow', { hasText: title }).locator('img')).toBeVisible();

  // ainda não é público
  await page.goto('/imoveis?q=E2E');
  await expect(page.locator('.card', { hasText: title })).toHaveCount(0);

  // admin aprova
  const admCtx = await browser.newContext();
  const adm = await admCtx.newPage();
  await adm.goto('/entrar');
  await adm.getByLabel('E-mail').fill('admin@moraago.local');
  await adm.getByLabel('Senha').fill('moraa-admin-demo');
  await adm.locator('form').getByRole('button', { name: /Entrar/ }).click();
  await expect(adm).toHaveURL(/minha-conta/);
  await adm.goto('/admin');
  const row = adm.locator('.orow', { hasText: title });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Aprovar' }).click();
  await expect(adm.getByText('Anúncio aprovado e publicado.')).toBeVisible();
  await admCtx.close();

  // público: aparece, sem telefone no HTML; contato abre wa.me
  const pubCtx = await browser.newContext();
  const pub = await pubCtx.newPage();
  await pub.goto('/imoveis?city=senador-canedo&neighborhood=Bairro%20E2E');
  await pub.locator('.card', { hasText: title }).click();
  await expect(pub.locator('.detail__title')).toHaveText(title);
  expect(await pub.content()).not.toContain('62900000000');
  const [resp] = await Promise.all([pub.waitForResponse(/\/contact$/), pub.locator('.buy').getByRole('button', { name: /WhatsApp/ }).click()]);
  expect((await resp.json()).whatsappUrl).toContain('wa.me/5562900000000');
  await pubCtx.close();

  // dono pausa → some da busca
  await page.goto('/minha-conta');
  await page.locator('.orow', { hasText: title }).getByRole('button', { name: 'Pausar' }).click();
  await expect(page.locator('.orow', { hasText: title }).locator('.tag--pausado')).toBeVisible();
  await page.goto('/imoveis?neighborhood=Bairro%20E2E&city=senador-canedo');
  await expect(page.locator('.card', { hasText: title })).toHaveCount(0);
});

test('admin é protegido e planos não cobram', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/entrar/);
  const r = await page.request.get('/api/admin/metrics');
  expect(r.status()).toBe(401);
  await page.goto('/planos');
  await expect(page.getByText('Modo demonstrativo — sem cobrança.')).toBeVisible();
  await page.getByRole('button', { name: 'Tenho interesse' }).first().click();
  await expect(page.getByText('Interesse registrado.').first()).toBeVisible();
});

test('SEO e PWA: metadados, manifest, sitemap e service worker', async ({ page, request }) => {
  const m = await (await request.get('/manifest.webmanifest')).json();
  expect(m.display).toBe('standalone');
  expect(m.icons.some((i: any) => i.sizes === '512x512' && i.purpose === 'maskable')).toBeTruthy();
  expect((await request.get('/sw.js')).ok()).toBeTruthy();
  expect(await (await request.get('/sitemap.xml')).text()).toContain('/imovel/');
  const list = await (await request.get('/api/listings')).json();
  const html = await (await request.get(`/imovel/${list.items[0].slug}`)).text();
  expect(html).toContain('og:image');
  expect(html).toContain(list.items[0].title);
  await page.goto('/');
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()))).toBeTruthy();
});
