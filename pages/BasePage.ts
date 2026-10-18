import type { Locator, Page } from '@playwright/test';

/** Shared base for every page object: the page, relative navigation and the environment banner. */
export class BasePage {
  readonly page: Page;
  readonly envBanner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.envBanner = page.getByTestId('env-banner');
  }

  /** Navigates with a relative path so the configured base URL selects the target. */
  protected async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }
}
