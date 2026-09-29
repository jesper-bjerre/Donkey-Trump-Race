import { expect, test } from '@playwright/test';
import { createErrorEnvelope } from '../packages/shared-protocol/src/errors.js';
import { createRoom, joinViaInvite } from './helpers.js';

test('400: an invalid nickname focuses the nickname field', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Nickname').fill('<b>');
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page.getByRole('alert')).toContainText('letters, numbers');
  await expect(page.getByLabel('Nickname')).toBeFocused();
});

test('404: an unknown room offers checking the code or creating a room', async ({ page }) => {
  await page.goto('/rooms/ZZZZZ');
  await page.getByLabel('Nickname').fill('LarsFan');
  await page.getByRole('button', { name: 'Join room' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('No room with that code');
  await alert.getByRole('button', { name: 'Create a new room' }).click();
  await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
});

test(
  '409: joining a race in progress explains and offers another room',
  { tag: '@webgl' },
  async ({ page, browser }) => {
    const code = await createRoom(page, 'Host');
    await page.getByRole('button', { name: 'Start race' }).click();
    await expect(page.locator('.viewport canvas')).toBeVisible();
    const late = await joinViaInvite(browser, code, 'Latecomer');
    const alert = late.page.getByRole('alert');
    await expect(alert).toContainText('already started');
    await alert.getByRole('button', { name: 'Pick another room' }).click();
    await expect(late.page.getByLabel('Room code')).toHaveValue('');
    await expect(late.page.getByLabel('Room code')).toBeFocused();
    await late.context.close();
  },
);

test('410: an expired room points to creating a new one', async ({ page }) => {
  await page.route('**/api/v1/rooms/*/join', (route) =>
    route.fulfill({
      status: 410,
      contentType: 'application/json',
      body: JSON.stringify(createErrorEnvelope('ROOM_EXPIRED', 'corr-e2e')),
    }),
  );
  await page.goto('/rooms/B3C4D');
  await page.getByLabel('Nickname').fill('LarsFan');
  await page.getByRole('button', { name: 'Join room' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('expired');
  await expect(alert.getByRole('button', { name: 'Create a new room' })).toBeVisible();
});

test('a server error never shows internals', async ({ page }) => {
  await page.route('**/api/v1/rooms', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({
        ...createErrorEnvelope('INTERNAL_ERROR', 'corr-e2e'),
        stack: 'Error: boom at GameService.ts:1',
      }),
    }),
  );
  await page.goto('/');
  await page.getByLabel('Nickname').fill('LarsFan');
  await page.getByRole('button', { name: 'Create room' }).click();
  await expect(page.getByRole('alert')).toContainText('Something went wrong');
  await expect(page.locator('body')).not.toContainText('GameService');
});
