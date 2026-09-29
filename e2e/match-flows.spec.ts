import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import { LOBBY_USERS } from './fixtures/lobbyUsers.js';
import { createRoom, joinViaInvite } from './helpers.js';

/**
 * Proxies the game WebSocket through Playwright so a test can inject server frames
 * (e.g. the end of a race) or drop the connection like a failing network would.
 */
async function proxyGameSocket(page: Page): Promise<() => WebSocketRoute> {
  let route: WebSocketRoute | null = null;
  await page.routeWebSocket('**/ws', (ws) => {
    ws.connectToServer();
    route = ws;
  });
  return () => {
    if (!route) throw new Error('game socket not connected yet');
    return route;
  };
}

/** Pretends the server ended the race (the real race takes minutes). */
function finishRaceFor(socket: () => WebSocketRoute) {
  socket().send(
    JSON.stringify({
      type: 'server.matchEnded',
      protocolVersion: 1,
      matchId: 'm_0123456789ab',
      finishOrder: [
        {
          rank: 1,
          playerId: 'p_e2e_winner',
          slotIndex: 1,
          nickname: 'Mette',
          color: 'blue',
          finishTick: 5400,
          serverTimeMs: 90_000,
        },
      ],
      highlights: {
        barrelHits: 4,
        falls: 2,
        shoves: 3,
        itemUses: 1,
        disconnects: 0,
        fastestRescueMs: 87_000,
      },
      outcome: 'completed',
      canReplay: true,
    }),
  );
}

test('a dropped connection shows the connection-lost screen with recovery actions', async ({
  page,
}) => {
  const socket = await proxyGameSocket(page);
  const code = await createRoom(page, LOBBY_USERS[0]);
  await socket().close({ code: 4410, reason: 'Slot unavailable' });
  const heading = page.getByRole('heading', { level: 1, name: 'Connection lost' });
  await expect(heading).toBeFocused();
  await page.getByRole('button', { name: 'Rejoin room' }).click();
  await expect(page).toHaveURL(new RegExp(`/rooms/${code}$`));
  await expect(page.getByLabel('Room code')).toHaveValue(code);
});

test(
  'the results screen shows the server order and highlights, and lets the host replay',
  { tag: '@webgl' },
  async ({ page }) => {
    const socket = await proxyGameSocket(page);
    const code = await createRoom(page, LOBBY_USERS[0]);
    await page.getByRole('button', { name: 'Start race' }).click();
    await expect(page.getByRole('status', { name: 'Objective' })).toBeVisible();
    finishRaceFor(socket);

    await expect(page).toHaveURL(new RegExp(`/rooms/${code}/results$`));
    await expect(page.getByRole('heading', { name: 'Mette rescued Motzfeldt!' })).toBeFocused();
    await expect(page.getByText('87.0s')).toBeVisible();
    await expect(page.locator('.highlights')).toContainText('Barrel hits4');

    const replay = page.waitForResponse((r) => r.url().endsWith(`/api/v1/rooms/${code}/replay`));
    await page.getByRole('button', { name: 'Play again' }).click();
    const response = await replay;
    expect(response.request().headers().authorization).toMatch(/^Bearer [\w-]+\.[\w-]+$/);
    // The race only ended in this browser (injected frame); the real server still runs it,
    // so it refuses the rematch and the host sees the catalog message.
    expect(response.status()).toBe(409);
    await expect(page.getByRole('alert')).toContainText('already started');
  },
);

test.describe('results accessibility', { tag: ['@a11y', '@keyboard'] }, () => {
  test(
    'results pass axe and are fully keyboard operable',
    { tag: '@webgl' },
    async ({ page, browser }) => {
      const socket = await proxyGameSocket(page);
      const code = await createRoom(page, LOBBY_USERS[0]);
      const guest = await joinViaInvite(browser, code, LOBBY_USERS[1]);
      await guest.page.getByRole('button', { name: "I'm ready" }).focus();
      await guest.page.keyboard.press('Enter');
      await expect(page.getByRole('button', { name: 'Start race' })).toBeEnabled();
      await page.getByRole('button', { name: 'Start race' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status', { name: 'Objective' })).toBeVisible();
      finishRaceFor(socket);
      await expect(page.getByRole('heading', { name: 'Mette rescued Motzfeldt!' })).toBeFocused();

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations.map((v) => v.id)).toEqual([]);

      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Play again' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(page.getByRole('button', { name: 'Back to lobby' })).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
      await guest.context.close();
    },
  );
});

test(
  'the race scene has the MVP level and a labelled object per player',
  { tag: '@webgl' },
  async ({ page, browser }) => {
    const code = await createRoom(page, LOBBY_USERS[0]);
    const guest = await joinViaInvite(browser, code, LOBBY_USERS[1]);
    await guest.page.getByRole('button', { name: "I'm ready" }).click();
    await page.getByRole('button', { name: 'Start race' }).click();
    const canvas = page.locator('.viewport canvas');
    await expect(canvas).toHaveAttribute('data-player-objects', /player\.jumpman\.1/);
    const scene = ((await canvas.getAttribute('data-scene-objects')) ?? '').split(' ');
    expect(scene.filter((n) => n.startsWith('mvp.floor.')).length).toBeGreaterThanOrEqual(3);
    expect(scene.filter((n) => n.startsWith('mvp.ladder.')).length).toBeGreaterThanOrEqual(2);
    const players = ((await canvas.getAttribute('data-player-objects')) ?? '').split(' ');
    expect(players).toEqual([
      'player.jumpman.0:player.label:effect.stars.0',
      'player.jumpman.1:player.label:effect.stars.1',
    ]);
    await guest.context.close();
  },
);
