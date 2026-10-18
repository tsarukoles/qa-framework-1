import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** The blog home page: the list of article cards. */
export class BlogListPage extends BasePage {
  readonly articleList: Locator;
  readonly articleItems: Locator;
  /** The link inside each card; scoped to the list so only card links are matched. */
  readonly articleLinks: Locator;

  constructor(page: Page) {
    super(page);
    this.articleList = page.getByTestId('article-list');
    this.articleItems = page.getByTestId('article-item');
    this.articleLinks = this.articleList.getByTestId('article-link');
  }

  async open(): Promise<void> {
    await this.goto('/');
  }
}
