import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createRoom } from './helpers.js';

/** WCAG 2.1 A/AA rules; the WebGL canvas is excluded (it is a labelled image). */
async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .exclude('.viewport canvas')
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary).toEqual([]);
}

test.describe('core screens pass axe', { tag: '@a11y' }, () => {
  test('landing', async ({ page }) => {
    await page.goto('/');
    await expectNoViolations(page);
  });

  test('landing with a join error', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Nickname').fill('LarsFan');
    await page.getByLabel('Room code').fill('ZZZZZ');
    await page.getByRole('button', { name: 'Join room' }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expectNoViolations(page);
  });

  test('help dialog', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'How to play & privacy' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expectNoViolations(page);
  });

  test('privacy notice', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy notice' })).toBeFocused();
    await expectNoViolations(page);
  });

  test('lobby', async ({ page }) => {
    await createRoom(page, 'Jumpman Løkke');
    await expectNoViolations(page);
  });

  test('race HUD', async ({ page }) => {
    await createRoom(page, 'Jumpman Løkke');
    await page.getByRole('button', { name: 'Start race' }).click();
    await expect(page.getByRole('status', { name: 'Objective' })).toBeVisible();
    await expectNoViolations(page);
  });
});
