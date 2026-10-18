import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/**
 * One article's detail page. A test reaches it by following a card link, so there is no open().
 * Test IDs observed on dev on 2026-10-18 (Task 01 exploration).
 */
export class ArticlePage extends BasePage {
  readonly detail: Locator;
  readonly title: Locator;
  readonly body: Locator;

  constructor(page: Page) {
    super(page);
    this.detail = page.getByTestId('article-detail');
    this.title = page.getByTestId('article-title');
    this.body = page.getByTestId('article-body');
  }
}
