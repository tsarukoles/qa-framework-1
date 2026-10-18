# Vault map

Start here. The vault keeps the project's notes beside the code: what each spec proves, how the hooks are wired, what happened and when.

## Tree

```text
vault/
├── _map.md                        this file
├── _context.md                    verified state, limits, next work
├── _raw/                          rough notes (empty; .gitkeep keeps the folder)
├── _changelog/                    automatic records: YYYY-MM-DD.md (tracked), sessions.log (ignored)
├── 03-framework/
│   └── hook-lifecycle-map.md      the hooks: configured, verified, planned
├── tests/
│   └── blog/                      one note per spec: a generated block plus human text
└── 12-progress-report/
    └── tsarukoles/                the daily journal written by /worklog
```

## Spec notes (one per spec file)

| Note                                                                     | Spec                                                                       | Page Objects used         |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------- |
| [Blog home: banner and cards](tests/blog/home.smoke.md)                  | [home.smoke.spec.ts](../tests/blog/home.smoke.spec.ts)                     | BlogListPage              |
| [Categories for a signed-in author](tests/blog/categories.smoke.md)      | [categories.smoke.spec.ts](../tests/blog/categories.smoke.spec.ts)         | LoginPage, CategoriesPage |
| [Article detail from the first card](tests/blog/article-detail.smoke.md) | [article-detail.smoke.spec.ts](../tests/blog/article-detail.smoke.spec.ts) | BlogListPage, ArticlePage |
| [Home filter by category](tests/blog/home-filter.smoke.md)               | [home-filter.smoke.spec.ts](../tests/blog/home-filter.smoke.spec.ts)       | BlogListPage              |

The block between the generated markers in each note is written by `node scripts/vault-sync.mjs --write` (source path, hash, parser status, titles, Page Object imports). The text below it is written by people. `npm run vault:check` reports a stale or missing note; the pre-commit hook refreshes the notes of the specs being committed.

## Page Objects

- [BasePage.ts](../pages/BasePage.ts): shared `page`, relative `goto`, the environment banner
- [BlogListPage.ts](../pages/BlogListPage.ts): article list, links, categories, the filter form
- [LoginPage.ts](../pages/LoginPage.ts): the login form and `login(email, password)`
- [CategoriesPage.ts](../pages/CategoriesPage.ts): the category list
- [ArticlePage.ts](../pages/ArticlePage.ts): one article's detail page

## Environment helpers and shared data

- [env/target.ts](../env/target.ts): `APP_ENV` rules, the dev and prod addresses, the pinned target
- [env/runIfEnv.ts](../env/runIfEnv.ts): test eligibility per environment
- [env/envGuard.ts](../env/envGuard.ts): the guard in front of a data change
- [tests/support/users.ts](../tests/support/users.ts): the teaching login
- [tests/support/env.ts](../tests/support/env.ts): the base URL for Playwright

## Rules and checks

- [CLAUDE.md](../CLAUDE.md): the short overview and the table of rule files
- [01-guardrails.md](../.claude/rules/01-guardrails.md): safety, secrets, never bypass a hook, the shared-file tiers
- [10-playwright-pom.md](../.claude/rules/10-playwright-pom.md): locators, Page Objects, waits, assertions
- [20-data-management.md](../.claude/rules/20-data-management.md): seed data, unique records, cleanup
- [30-test-names.md](../.claude/rules/30-test-names.md): titles that name the action and the result
- [Hook lifecycle map](03-framework/hook-lifecycle-map.md): the `.claude/settings.json` hooks and their verification status
- [.husky/pre-commit](../.husky/pre-commit) and [.husky/pre-push](../.husky/pre-push): the Git checks, with [secret-scan.mjs](../scripts/hooks/secret-scan.mjs), [vault-precommit.mjs](../scripts/hooks/vault-precommit.mjs) and [pre-push-check.mjs](../scripts/hooks/pre-push-check.mjs)
- [validate-vault.mjs](../scripts/validate-vault.mjs): `npm run vault:validate`, the links and structure of this folder

## Records and the journal

- [Context](_context.md): what is verified, what is not, what comes next
- [Journal 2026-10-18](12-progress-report/tsarukoles/2026-10-18.md): today's work, appended by `/worklog`
- `_changelog/YYYY-MM-DD.md`: one entry per file Claude changed through `Edit` or `Write` (created by the first live session)
- [Evidence notes](../evidence/): the per-task verification notes and the two saved raw drafts
