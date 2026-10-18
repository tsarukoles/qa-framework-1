import { expect, test } from '@playwright/test';
import { runIfEnv } from '../../env/runIfEnv';
import { BlogListPage } from '../../pages/BlogListPage';

test.describe('blog home on development', () => {
  runIfEnv(test, ['dev']);

  test('shows the development banner', async ({ page }) => {
    const blog = new BlogListPage(page);
    await blog.open();
    await expect(blog.envBanner).toBeVisible();
    await expect(blog.envBanner).toContainText('DEVELOPMENT');
  });

  test('shows at least one article card', async ({ page }) => {
    const blog = new BlogListPage(page);
    await blog.open();
    await expect(blog.articleItems).not.toHaveCount(0);
    await expect(blog.articleItems.first()).toBeVisible();
  });
});
