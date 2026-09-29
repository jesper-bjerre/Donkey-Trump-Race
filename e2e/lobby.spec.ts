import { expect, test, type BrowserContext } from '@playwright/test';
import { LOBBY_USERS, SIXTH_USER, SLOT_COLOR_LABELS } from './fixtures/lobbyUsers.js';
import { createRoom, joinViaInvite } from './helpers.js';

test('five players fill the lobby with unique labelled colours and the sixth is turned away', async ({
  page,
  browser,
}) => {
  const contexts: BrowserContext[] = [];
  const code = await createRoom(page, LOBBY_USERS[0]);
  await expect(page).toHaveURL(new RegExp(`/rooms/${code}$`));

  for (const nickname of LOBBY_USERS.slice(1)) {
    const guest = await joinViaInvite(browser, code, nickname);
    contexts.push(guest.context);
    await expect(guest.page.getByRole('heading', { name: 'Lobby' })).toBeVisible();
  }

  for (const [slot, nickname] of LOBBY_USERS.entries()) {
    await expect(
      page.getByRole('listitem', {
        name: new RegExp(`^Player ${slot + 1}, ${nickname}, ${SLOT_COLOR_LABELS[slot]}`),
      }),
    ).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Players (5/5)' })).toBeVisible();
  await expect(page.getByTestId('roster-announcement')).toContainText('joined');

  const sixth = await joinViaInvite(browser, code, SIXTH_USER);
  contexts.push(sixth.context);
  const alert = sixth.page.getByRole('alert');
  await expect(alert).toContainText('already has 5 players');
  await expect(alert.getByRole('button', { name: 'Create a new room' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Players (5/5)' })).toBeVisible();

  for (const context of contexts) await context.close();
});

test('the host sees why the race cannot start until guests are ready', async ({
  page,
  browser,
}) => {
  const code = await createRoom(page, 'Host');
  const guest = await joinViaInvite(browser, code, 'Guest');
  await expect(page.getByRole('status').filter({ hasText: 'Waiting for Guest' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Start race' })).toBeDisabled();
  await guest.page.getByRole('button', { name: "I'm ready" }).click();
  await expect(page.getByTestId('roster-announcement')).toHaveText('Guest is ready.');
  await expect(page.getByRole('button', { name: 'Start race' })).toBeEnabled();
  await guest.context.close();
});
