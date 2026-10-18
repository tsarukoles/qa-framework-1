import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** The categories page shown to a signed-in author. */
export class CategoriesPage extends BasePage {
  readonly list: Locator;
  readonly items: Locator;

  constructor(page: Page) {
    super(page);
    this.list = page.getByTestId('category-list');
    this.items = page.getByTestId('category-item');
  }

  async open(): Promise<void> {
    await this.goto('/categories');
  }
}
