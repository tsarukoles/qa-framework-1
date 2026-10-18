# tests/blog/categories.smoke.spec.ts

<!-- vault:generated:start -->
- source: tests/blog/categories.smoke.spec.ts
- sha256: 87d2f91bf802b59cc69c6d7bd4446e470fb7c49869aad95159510a01a618a33c
- parser: ok
- titles:
  - describe: categories on development
    - test: shows the category list to a signed-in author
- page objects: CategoriesPage from ../../pages/CategoriesPage; LoginPage from ../../pages/LoginPage
<!-- vault:generated:end -->

## What this spec checks

One check that a signed-in author sees the categories page on dev: `LoginPage.login(AUTHOR.email, AUTHOR.password)` with the shared teaching login from `tests/support/users.ts`, then `CategoriesPage.open()`, then the list (`category-list`) and its first item (`category-item`) are visible.

## Why it matters

It is the only Week 1 scenario that needs a login, so it proves the login flow and the author-only page together. The teaching login is course data, documented in `CLAUDE.md`; it is not a secret.

## Limits

It does not check which categories exist or their order. If the teaching login changes, this test fails first (the login data is a CRITICAL shared file, see `.claude/rules/01-guardrails.md`).
