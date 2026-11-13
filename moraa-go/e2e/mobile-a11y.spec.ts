import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('moraa-consent', '1'));
});

const PAGES = ['/', '/imoveis', '/planos', '/entrar', '/sobre', '/privacidade', '/termos', '/nao-existe'];

for (const path of PAGES) {
  test(`a11y + sem rolagem horizontal: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'rolagem horizontal').toBeLessThanOrEqual(0);
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    const bad = res.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? ''));
    expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
  });
}

test('a11y: detalhe e formulário de anúncio', async ({ page }) => {
  const list = await (await page.request.get('/api/listings')).json();
  await page.goto(`/imovel/${list.items[0].slug}`);
  await page.waitForLoadState('networkidle');
  let res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(res.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  await page.request.post('/api/auth/register', { headers: { 'X-Requested-With': 'moraa' }, data: { name: 'A11y Teste', email: `a11y-${Date.now()}-${Math.random().toString(36).slice(2)}@teste.local`, password: 'senha-bem-longa-1', acceptTerms: true } });
  await page.goto('/anunciar');
  await page.waitForSelector('.pform');
  res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(res.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
});

test('mobile: menu, filtros em folha e alvos de toque', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'somente no perfil mobile');
  await page.goto('/');
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await expect(page.locator('#menu')).toBeVisible();
  await page.locator('#menu').getByRole('link', { name: 'Buscar imóveis' }).click();
  await expect(page).toHaveURL(/imoveis/);
  await page.getByRole('button', { name: /Filtros/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Filtros' });
  await sheet.getByLabel('Apartamento').click();
  await sheet.getByRole('button', { name: /Ver \d+ imóve/ }).click();
  await expect(page).toHaveURL(/type=apartamento/);
  await expect(page.locator('.card')).toHaveCount(3);
  // alvos de toque ≥ 44px nos controles principais
  const small = await page.evaluate(() => [...document.querySelectorAll('.btn, .select, .hdr__menu')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 44; }).length);
  expect(small).toBe(0);
});
