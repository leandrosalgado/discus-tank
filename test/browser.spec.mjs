import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';

test('desktop model, views, visibility controls and PDF', async ({ page, request }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('./');
  await expect(page).toHaveTitle('Discus aquarium');
  await expect(page.getByText('Option B', { exact: false })).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('data-viewer-state', 'ready', { timeout: 45000 });
  await expect(page.locator('html')).toHaveAttribute('data-mesh-count', '173');
  await expect(page.getByRole('checkbox')).toHaveCount(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('desktop.png') });

  await page.getByRole('checkbox', { name: 'Filter housing', exact: true }).uncheck();
  await expect(page.locator('html')).not.toHaveAttribute('data-visible-categories', /housing/);
  await page.getByRole('button', { name: 'Look inside the plumbing' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-visible-categories', 'pipes,stand,filter');
  await page.screenshot({ path: testInfo.outputPath('cutaway.png') });
  await page.getByRole('button', { name: 'Show all', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-visible-categories', 'glass,cover,housing,pipes,stand,filter');
  for (const name of ['Front', 'Top', 'Side', '3D view']) {
    const button = page.getByRole('button', { name, exact: true });
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
  }
  await page.getByRole('button', { name: 'Bottom', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bottom', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-visible-categories', 'pipes,filter');
  await page.screenshot({ path: testInfo.outputPath('bottom.png') });
  await page.getByRole('button', { name: 'Show all', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-visible-categories', 'glass,cover,housing,pipes,stand,filter');
  const pdfUrl = await page.getByRole('link', { name: /Drawings/ }).getAttribute('href');
  const pdf = await request.get(new URL(pdfUrl, page.url()).href);
  expect(pdf.ok()).toBe(true);
  const metadata = await (await request.get(new URL('./assets/model-info.json', page.url()).href)).json();
  expect(createHash('sha256').update(await pdf.body()).digest('hex')).toBe(metadata.pdfSha256);
  expect(errors).toEqual([]);
});

test('mobile controls remain usable without horizontal overflow', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-viewer-state', 'ready', { timeout: 45000 });
  await expect(page.locator('#controls-panel')).not.toBeVisible();
  const controls = page.getByRole('button', { name: 'Controls', exact: true });
  await controls.click();
  await expect(controls).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('button', { name: 'Close controls', exact: true })).toBeFocused();
  await expect(page.getByRole('checkbox', { name: 'Glass panels', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('mobile-controls.png') });
  await page.getByRole('button', { name: 'Look inside the plumbing' }).click();
  await expect(page.locator('#controls-panel')).not.toBeVisible();
  await expect(controls).toBeFocused();
  await expect(page.locator('html')).toHaveAttribute('data-visible-categories', 'pipes,stand,filter');
  await page.screenshot({ path: testInfo.outputPath('mobile.png') });
  await controls.click();
  await page.getByRole('button', { name: 'Close controls', exact: true }).click();
  await expect(controls).toBeFocused();
  await controls.click();
  await page.keyboard.press('Escape');
  await expect(controls).toHaveAttribute('aria-expanded', 'false');
  await expect(controls).toBeFocused();
  for (const width of [320, 760, 820]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width <= 760) {
      await controls.click();
      const bounds = await page.getByRole('button', { name: 'Close controls', exact: true }).boundingBox();
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
      await page.getByRole('button', { name: 'Bottom', exact: true }).click();
      await expect(page.locator('#controls-panel')).not.toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('data-visible-categories', 'pipes,filter');
      await expect(controls).toBeFocused();
      await page.screenshot({ path: testInfo.outputPath(`bottom-${width}.png`) });
    }
  }
  expect(errors).toEqual([]);
});

test('model-load failures are visible and keep the PDF accessible', async ({ page }) => {
  await page.route('**/aquarium.glb', route => route.abort());
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('data-viewer-state', 'error');
  await expect(page.getByRole('alert')).toContainText('could not be loaded');
  await expect(page.getByRole('link', { name: 'Open the drawings instead' })).toBeVisible();
});
