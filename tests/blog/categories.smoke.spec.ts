import { expect, test } from '@playwright/test';
import { runIfEnv } from '../../env/runIfEnv';
import { loginViaUi } from '../support/auth';
import { AUTHOR } from '../support/users';

test.describe('categories on development', () => {
  runIfEnv(test, ['dev']);

  test('shows the category list to a signed-in author', async ({ page }) => {
    await loginViaUi(page, AUTHOR);
    await page.goto('/categories');
    await expect(page.getByTestId('category-list')).toBeVisible();
    await expect(page.getByTestId('category-item').first()).toBeVisible();
  });
});
