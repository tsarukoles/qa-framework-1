# Task 02 — Page Objects: verification note

Recorded 2026-10-18 on branch `week-2`. All browser runs: dev through the existing resolver, one Chromium project, zero retries.

## Baseline before the refactor

| Check | Result |
|---|---|
| `npm test -- --reporter=list` | 3 passed (2.0s) (3 tests in 2 files) |
| `npm run typecheck` | exit 0 |
| `npm run test:safety` | 6 isolated checks, 6 passed |
| `evidence/task01-raw-draft.ts` | sha256 `1994ccc80021d11e…` (unchanged throughout this task) |

The only active importer of `tests/support/auth.ts` was `tests/blog/categories.smoke.spec.ts`.

## What moved where

| File | Owns |
|---|---|
| `pages/BasePage.ts` | `page`, protected relative `goto(path)`, `envBanner` (`env-banner`) |
| `pages/BlogListPage.ts` | `open()` → `/`, `articleList` (`article-list`), `articleItems` (`article-item`), `articleLinks` (`article-link`, scoped to the list) |
| `pages/LoginPage.ts` | `open()` → `/login`, `emailInput`, `passwordInput`, `submitButton` (`login-email`, `login-password`, `login-submit`), `login(email, password)` = the former `loginViaUi` flow including its `waitForURL` |
| `pages/CategoriesPage.ts` | `open()` → `/categories`, `list` (`category-list`), `items` (`category-item`) |

`tests/support/auth.ts` was deleted after no active import remained. The archived draft keeps its historical imports and bytes. `tsconfig.json` now includes `pages/**/*.ts`.

## One assertion before and after

Before (`tests/blog/categories.smoke.spec.ts`):

```ts
await expect(page.getByTestId('category-list')).toBeVisible();
```

After:

```ts
await expect(categories.list).toBeVisible();
```

Same scenario, same matcher, same expected result; the locator detail now lives in `CategoriesPage`.

Every assertion, expected value, `runIfEnv(test, ['dev'])` call, test title and the `AUTHOR` teaching-user import were kept. Only imports, navigation calls and the login call changed.

## Verification after the core refactor

| Check | Result |
|---|---|
| `npm run typecheck` | exit 0 |
| `npm test -- --reporter=list` | 3 passed (2.3s), same three titles |
| `npm run test:safety` | 6 passed |
| Raw locators in `tests/` (`getBy*(`, `.locator(`, `page.$(`) | none found; no `page.` call remains in a spec |
| `support/auth` imports in `tests/` and `pages/` | none |
| `article-item` in active code | only `pages/BlogListPage.ts:13` — a future rename of that test ID changes this one line |

Limit of the text search: it only proves the searched patterns are absent. The code review above covers the other locator forms (there are none; every element is reached through a page-object field).

## Practice: the Page Object the saved draft needs

`evidence/task01-raw-draft.ts` uses `article-list` + `article-link` (home) and `article-detail`, `article-title`, `article-body` (detail page).

- `BlogListPage.articleLinks` was added (the draft's `getByTestId('article-list').getByTestId('article-link')`).
- `pages/ArticlePage.ts` is new with `detail`, `title`, `body`. The test arrives by clicking a card, so the class has no `open()`.

| Check after the practice | Result |
|---|---|
| `npm run typecheck` (both classes included) | exit 0 |
| `npm test -- --reporter=list` | 3 passed (2.2s) |
| `npm run test:safety` | 6 passed |
| `npx playwright test --list` | 3 tests in 2 files (no new browser case) |
| Raw draft | unchanged |

Typechecking `ArticlePage` proves it compiles, not that its locators find the elements at run time. Task 04 verifies that through the reviewed active test.
