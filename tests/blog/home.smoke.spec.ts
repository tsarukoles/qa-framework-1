import { expect, test } from '@playwright/test';
import { runIfEnv } from '../../env/runIfEnv';

test.describe('blog home on development', () => {
  runIfEnv(test, ['dev']);

  test('shows the development banner', async ({ page }) => {
    await page.goto('/');
    const banner = page.getByTestId('env-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('DEVELOPMENT');
  });

  test('shows at least one article card', async ({ page }) => {
    await page.goto('/');
    const cards = page.getByTestId('article-item');
    await expect(cards).not.toHaveCount(0);
    await expect(cards.first()).toBeVisible();
  });
});
