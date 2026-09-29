import { expect, test } from '@playwright/test';

test.describe('keyboard-only play', { tag: '@keyboard' }, () => {
  test('tab order on the landing page follows the visual order', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByLabel('Nickname')).toBeFocused();
    const order = [
      'Room code',
      'Create room',
      'Join room',
      'How to play & privacy',
      'Privacy notice',
    ];
    for (const name of order) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      await expect(focused).toHaveAccessibleName(name);
    }
  });

  test(
    'create a room, start and open help without a mouse',
    { tag: '@webgl' },
    async ({ page }) => {
      await page.goto('/');
      await page.keyboard.type('Keyboard Kim');
      await page.keyboard.press('Tab'); // room code
      await page.keyboard.press('Tab'); // Create room
      await page.keyboard.press('Enter');
      await expect(page.getByRole('heading', { name: 'Lobby' })).toBeVisible();

      const start = page.getByRole('button', { name: 'Start race' });
      await expect(start).toBeEnabled();
      for (
        let i = 0;
        i < 10 && !(await start.evaluate((el) => el === document.activeElement));
        i++
      ) {
        await page.keyboard.press('Tab');
      }
      await expect(start).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('status', { name: 'Objective' })).toBeVisible();

      await page.keyboard.press('?');
      const dialog = page.getByRole('dialog', { name: 'How to play' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    },
  );

  test('focus is visible on every interactive landing control', async ({ page }) => {
    await page.goto('/');
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const outline = await page
        .locator(':focus')
        .evaluate((el) => getComputedStyle(el).outlineStyle);
      expect(outline).not.toBe('none');
    }
  });
});
