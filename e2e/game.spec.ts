import { expect, test } from '@playwright/test';
import { createRoom } from './helpers.js';

test('landing page shows the title and entry form', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Donkey Trump Race');
  await expect(page.getByRole('heading', { name: 'Donkey Trump Race' })).toBeVisible();
  await expect(page.getByLabel('Nickname')).toBeFocused();
  await expect(page.getByLabel('Room code')).toBeVisible();
});

test('invalid join shows a recoverable error and focuses the room code', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Nickname').fill('LarsFan');
  await page.getByLabel('Room code').fill('ZZZZZ');
  await page.getByRole('button', { name: 'Join room' }).click();
  await expect(page.getByRole('alert')).toContainText('No room with that code');
  await expect(page.getByLabel('Room code')).toBeFocused();
});

test('a solo host can start a race and see the 3D view', async ({ page }) => {
  await createRoom(page, 'Jumpman Løkke');
  await expect(
    page.getByRole('listitem', { name: /Player 1, Jumpman Løkke, Red, host/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Start race' }).click();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  await expect(page.getByRole('status', { name: 'Countdown' })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Objective' })).toContainText('Motzfeldt');
});

test('two players join, ready up and race together', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  const code = await createRoom(host, 'Host');
  await guest.goto(`/?room=${code}`);
  await expect(guest.getByLabel('Room code')).toHaveValue(code);
  await guest.getByLabel('Nickname').fill('Guest');
  await guest.getByRole('button', { name: 'Join room' }).click();

  await expect(host.getByRole('listitem', { name: /Player 2, Guest, Blue/ })).toBeVisible();
  await expect(host.getByRole('button', { name: 'Start race' })).toBeDisabled();
  await guest.getByRole('button', { name: "I'm ready" }).click();
  await expect(host.getByRole('button', { name: 'Start race' })).toBeEnabled();
  await host.getByRole('button', { name: 'Start race' }).click();

  for (const page of [host, guest]) {
    await expect(page.locator('.viewport canvas')).toBeVisible();
    await expect(page.locator('.hud-ranking li')).toHaveCount(2);
  }
  await hostContext.close();
  await guestContext.close();
});
