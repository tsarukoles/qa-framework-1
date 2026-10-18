import { expect, test } from '@playwright/test';
import { runIfEnv } from '../../env/runIfEnv';

// Task 01 draft, written after observing dev with the Playwright MCP browser on 2026-10-18.
// Observed: the home page lists article cards (article-item) inside article-list; each card has
// one link (article-link) whose href is /articles/<slug>. Clicking the first link opened
// /articles/seeding-test-data-without-tears, which shows article-detail with an article-title
// heading equal to the link text and a non-empty article-body.

test.describe('blog article detail on development', () => {
  runIfEnv(test, ['dev']);

  test('opening the first article card shows that article', async ({ page }) => {
    await page.goto('/');

    const firstLink = page.getByTestId('article-list').getByTestId('article-link').first();
    const title = ((await firstLink.textContent()) ?? '').trim();
    const href = (await firstLink.getAttribute('href')) ?? '';
    expect(title).not.toBe('');
    expect(href).toMatch(/^[/]articles[/].+/);

    await firstLink.click();

    await expect(page).toHaveURL(href);
    await expect(page.getByTestId('article-detail')).toBeVisible();
    await expect(page.getByTestId('article-title')).toHaveText(title);
    await expect(page.getByTestId('article-body')).toBeVisible();
    await expect(page.getByTestId('article-body')).not.toBeEmpty();
  });
});
