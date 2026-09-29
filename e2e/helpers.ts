import { expect, type Browser, type Page } from '@playwright/test';

export async function createRoom(page: Page, nickname: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByRole('button', { name: 'Create room' }).click();
  const code = page.locator('output.room-code');
  await expect(code).toHaveText(/^[A-Z2-9]{5}$/);
  return (await code.textContent()) ?? '';
}

/** Opens the invite link in a fresh browser context and joins as `nickname`. */
export async function joinViaInvite(browser: Browser, code: string, nickname: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`/rooms/${code}`);
  await expect(page.getByLabel('Room code')).toHaveValue(code);
  await page.getByLabel('Nickname').fill(nickname);
  await page.getByRole('button', { name: 'Join room' }).click();
  return { context, page };
}
