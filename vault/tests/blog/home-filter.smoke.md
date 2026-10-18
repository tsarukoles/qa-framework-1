# tests/blog/home-filter.smoke.spec.ts

<!-- vault:generated:start -->
- source: tests/blog/home-filter.smoke.spec.ts
- sha256: 872c7fdbd2f52970e3fba26309d7218611a5067342e2b7bb30193e4f65cbb488
- parser: ok
- titles:
  - describe: blog home filter on development
    - test: filtering by a category shows only articles of that category
- page objects: BlogListPage from ../../pages/BlogListPage
<!-- vault:generated:end -->

## What this spec checks

The Task 04 behaviour: on the home page, choose the category "Playwright" in the filter form and submit it (`BlogListPage.filterByCategory`). Then the URL carries `category=playwright`, the select keeps the value, the list still has cards, the first card's category reads Playwright, and no card with another category remains (`articleCategories.filter({ hasNotText })` has count 0).

## Why it matters

Filtering is the first interaction on the home page that changes what is listed. The last assertion is the strong one: it proves nothing outside the chosen category is shown, which a visibility check alone would miss. The first passing draft is kept in `evidence/task04-raw-draft.ts`.

## Limits

It relies on the seeded data having at least one Playwright article. It does not check the search box or a combination of search and category.
