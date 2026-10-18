---
paths:
  - "tests/**"
  - "pages/**"
---

# Playwright and Page Objects

Applies to browser specs under `tests/` and Page Objects under `pages/`.

## Locators

- Priority: a verified `data-testid` first (`getByTestId`), then role plus accessible name (`getByRole`), then text (`getByText`). Check: every locator in `pages/` uses one of these three.
- No brittle CSS chains such as `div > ul > li:nth-child(2)` and no XPath. Check: searching `pages/` for `locator(` returns nothing unless a reviewer approved the line.
- A test ID counts as verified only when it was seen on the live dev page. Verified so far (Week 1, and the Task 01 exploration on 2026-10-18): `env-banner`, `article-list`, `article-item`, `article-link`, `article-detail`, `article-title`, `article-body`, `login-email`, `login-password`, `login-submit`, `category-list`, `category-item`, and from the Task 04 exploration on 2026-10-18: `category-select`, `filter-submit`, `article-category`. Any other ID is a guess until it is seen; say so in the review.

## Page Objects

- Element locators belong in `pages/`. No raw locators in `tests/`: no `getBy...(`, no `locator(`, no `page.$(`. Check: searching `tests/` for `getBy` and for `locator(` returns nothing.
- One class per page, extending `BasePage`. `BasePage` is shared code, not a page.
- Locator fields are `readonly` and set in the constructor. Methods are named for what the user intends, such as `open()` and `login(email, password)`, not one method per click.
- ⚠️ The same test ID in two classes is a trap: a rename then needs two edits and nothing today reports the duplicate. Check: searching `pages/` for `'article-item'` shows one line.

## Waits and assertions

- No fixed waits: never `waitForTimeout(`. Wait for a condition with a web-first assertion such as `await expect(locator).toBeVisible()`, which retries until its timeout. Check: searching `tests/` and `pages/` for `waitForTimeout` returns nothing.
- ⚠️ A fixed pause passes on a fast day and fails on a slow one, and no check flags it when it is added. Task 06 adds a guard for this.
- Each assertion matches the requirement the test exists for. One test proves one behaviour.
- No exact count on a shared list that changes (`toHaveCount(6)` on the article list) unless the requirement states the count. Use `not.toHaveCount(0)` or `.first()` visibility.
- Keep `runIfEnv(test, ['dev'])` in the `describe` block and relative paths in `goto`.

## One check worth automating later

A guard that refuses an edit which adds `waitForTimeout(` or `.only`, or removes an `expect(` (Task 06).
