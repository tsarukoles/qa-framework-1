import { expect, test } from '@playwright/test';
import { runIfEnv } from '../../env/runIfEnv';
import { ArticlePage } from '../../pages/ArticlePage';
import { BlogListPage } from '../../pages/BlogListPage';

// Reviewed version of evidence/task01-raw-draft.ts (Task 04). Same scenario and assertions;
// the element details now come from BlogListPage and ArticlePage.

test.describe('blog article detail on development', () => {
  runIfEnv(test, ['dev']);

  test('opening the first article card shows that article', async ({ page }) => {
    const blog = new BlogListPage(page);
    await blog.open();

    const firstLink = blog.articleLinks.first();
    const title = ((await firstLink.textContent()) ?? '').trim();
    const href = (await firstLink.getAttribute('href')) ?? '';
    expect(title).not.toBe('');
    expect(href).toMatch(/^[/]articles[/].+/);

    await firstLink.click();

    const article = new ArticlePage(page);
    await expect(page).toHaveURL(href);
    await expect(article.detail).toBeVisible();
    await expect(article.title).toHaveText(title);
    await expect(article.body).toBeVisible();
    await expect(article.body).not.toBeEmpty();
  });
});
