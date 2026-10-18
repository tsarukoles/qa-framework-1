import { expect, test } from '@playwright/test';
import { runIfEnv } from '../../env/runIfEnv';
import { CategoriesPage } from '../../pages/CategoriesPage';
import { LoginPage } from '../../pages/LoginPage';
import { AUTHOR } from '../support/users';

test.describe('categories on development', () => {
  runIfEnv(test, ['dev']);

  test('shows the category list to a signed-in author', async ({ page }) => {
    await new LoginPage(page).login(AUTHOR.email, AUTHOR.password);
    const categories = new CategoriesPage(page);
    await categories.open();
    await expect(categories.list).toBeVisible();
    await expect(categories.items.first()).toBeVisible();
  });
});
