import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** The blog home page: the list of article cards and the filter form above it. */
export class BlogListPage extends BasePage {
  readonly articleList: Locator;
  readonly articleItems: Locator;
  /** The link inside each card; scoped to the list so only card links are matched. */
  readonly articleLinks: Locator;
  /** The category label inside each card. */
  readonly articleCategories: Locator;
  readonly categorySelect: Locator;
  readonly filterButton: Locator;

  constructor(page: Page) {
    super(page);
    this.articleList = page.getByTestId('article-list');
    this.articleItems = page.getByTestId('article-item');
    this.articleLinks = this.articleList.getByTestId('article-link');
    this.articleCategories = this.articleList.getByTestId('article-category');
    this.categorySelect = page.getByTestId('category-select');
    this.filterButton = page.getByTestId('filter-submit');
  }

  async open(): Promise<void> {
    await this.goto('/');
  }

  /** Chooses a category by its visible label and submits the filter form (a GET request). */
  async filterByCategory(label: string): Promise<void> {
    await this.categorySelect.selectOption({ label });
    await this.filterButton.click();
  }
}
