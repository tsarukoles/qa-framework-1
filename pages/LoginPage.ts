import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

/** The login page. `login` performs the same flow the Week 1 helper used. */
export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByTestId('login-email');
    this.passwordInput = page.getByTestId('login-password');
    this.submitButton = page.getByTestId('login-submit');
  }

  async open(): Promise<void> {
    await this.goto('/login');
  }

  /** Opens the login page, submits the credentials and waits until the app leaves /login. */
  async login(email: string, password: string): Promise<void> {
    await this.open();
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
    await this.page.waitForURL((url) => url.pathname !== '/login');
  }
}
