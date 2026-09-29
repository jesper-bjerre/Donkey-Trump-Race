import { expect, test } from '@playwright/test';
import smoke from './fixtures/workspace-smoke.json' with { type: 'json' };
import { createRoom } from './helpers.js';

test('health endpoint reports the service', async ({ request }) => {
  const res = await request.get(smoke.health.path);
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({
    service: smoke.health.service,
    status: smoke.health.status,
  });
  expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
});

for (const route of smoke.pages) {
  test(`page ${route.path} renders`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page).toHaveTitle(smoke.title);
    await expect(page.getByRole('heading', { level: 1, name: route.heading })).toBeVisible();
    if (route.roomCode) await expect(page.getByLabel('Room code')).toHaveValue(route.roomCode);
  });
}

test('missing static assets return 404 instead of the app shell', async ({ request }) => {
  const res = await request.get('/sprites/does-not-exist.png');
  expect(res.status()).toBe(404);
});

test('the 3D scene contains the MVP level objects', async ({ page }) => {
  await createRoom(page, 'Scene Check');
  await page.getByRole('button', { name: 'Start race' }).click();
  const canvas = page.locator('.viewport canvas');
  await expect(canvas).toBeVisible();
  const names = ((await canvas.getAttribute('data-scene-objects')) ?? '').split(' ');
  for (const name of smoke.sceneObjects) expect(names).toContain(name);
});
