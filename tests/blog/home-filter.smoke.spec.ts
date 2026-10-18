import { expect, test } from '@playwright/test';
import { runIfEnv } from '../../env/runIfEnv';
import { BlogListPage } from '../../pages/BlogListPage';

// Task 04 fifth behaviour, observed on dev with the Playwright MCP browser on 2026-10-18:
// the home page filter form is a GET form (fields search + category) that reloads / with
// ?category=<slug>. Choosing "Playwright" showed two cards, every article-category read
// "Playwright" and the select kept the choice.

test.describe('blog home filter on development', () => {
  runIfEnv(test, ['dev']);

  test('filtering by a category shows only articles of that category', async ({ page }) => {
    const blog = new BlogListPage(page);
    await blog.open();
    await expect(blog.articleItems).not.toHaveCount(0);

    await blog.filterByCategory('Playwright');

    await expect(page).toHaveURL(/category=playwright/);
    await expect(blog.categorySelect).toHaveValue('playwright');
    await expect(blog.articleItems).not.toHaveCount(0);
    await expect(blog.articleCategories.first()).toHaveText('Playwright');
    await expect(blog.articleCategories.filter({ hasNotText: 'Playwright' })).toHaveCount(0);
  });
});
