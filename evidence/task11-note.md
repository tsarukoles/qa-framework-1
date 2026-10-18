# Task 11 — project notes current and easy to find: verification note

Recorded 2026-10-18 on branch `week-2`. Observed results only.

## Starting state

Branch `week-2`, clean. Four active spec files with five tests (`npx playwright test --list`: 5 tests in 4 files). Installed parser: TypeScript 6.0.3. Existing vault: `_map.md`, `_raw/.gitkeep`, `03-framework/hook-lifecycle-map.md`, the journal `12-progress-report/tsarukoles/2026-10-18.md`. No `vault/sources/jira/key-map.md` (the import needed no key map). Git hooks from Task 08; Prettier scope excludes raw drafts and the Jira package.

## Stage 1: generator and notes

`scripts/vault-sync.mjs` keeps `--from-hook`, `--session-start` and `--session-end` (their 14 isolated checks still pass) and adds:

- `--write [--files <spec…>] [--stage]` and `--check [--files <spec…>]`; `--root <dir>` for an explicit project root (then `VAULT_SYNC_ROOT`, `CLAUDE_PROJECT_DIR`, the working directory).
- Mapping `tests/<path>.spec.ts` → `vault/tests/<path>.md`; the TypeScript parser (`ts.createSourceFile`) reads literal `test()` / `test.describe()` titles and Page Object imports; a spec is never executed.
- The generated block between `<!-- vault:generated:start -->` and `<!-- vault:generated:end -->` records the source path, the sha256 of the source (line endings normalised to LF, so a Windows and a Linux checkout agree), the parser status, the nested titles and the Page Object imports. Text outside the markers is preserved byte for byte; the output is identical when the source is unchanged; damaged or repeated markers are refused.
- Reported instead of hidden: unsupported wrappers (`test.only`, `test.skip`, `test.describe.*` …), dynamic titles, parse errors. No empty note is written for them.
- Unknown or conflicting flags, `--stage` without `--write --files`, `--files` without a path, and paths outside `tests/` or not ending in `.spec.ts` are rejected.
- npm scripts: `vault:sync`, `vault:check`, `vault:validate`.

Notes created for the four specs (`node scripts/vault-sync.mjs --write`: 4 created; `--check` before: 4 MISSING, exit 1; after: 4 fresh, exit 0; second `--write`: 4 unchanged). Each note then received its human explanation (what the spec checks, why it matters, limits) under the generated block. `vault/_map.md` was rewritten with a tree and links to the notes, specs, Page Objects, environment helpers, rules, hooks and the journal; `vault/_context.md` records the verified state, the limits and the next work. Every link target exists (`npm run vault:validate`: 8 files, 0 errors, 0 warnings).

Generator proofs (`safety-tests/vault-sync.test.mjs`, disposable fixture under the system temp folder, run with `--root` while the working directory stays the real project):

| Proof                                                                  | Result                                                                                                                                                                                                          |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the explicit root decides where notes go                               | the note appeared in the fixture; the real `vault/tests/blog/home.smoke.md` was byte-identical before and after                                                                                                 |
| missing → write → clean check                                          | `--check` 1 (MISSING), `--write` 0 ("created"), `--check` 0                                                                                                                                                     |
| generated block content                                                | source, sha256 equal to the fixture file's hash, `parser: ok`, `describe`/`test` titles nested, `BlogListPage from ../../pages/BlogListPage`                                                                    |
| harmless source comment → stale → refresh → clean; second refresh      | `--check` 1 (STALE), `--write` "updated", `--check` 0, second `--write` "unchanged" with byte-identical note                                                                                                    |
| human text survives exactly                                            | text outside the markers identical after a refresh (custom paragraphs, an extra section, trailing spaces)                                                                                                       |
| CRLF note                                                              | the refreshed block keeps CRLF; LF or CRLF, the hash agrees                                                                                                                                                     |
| damaged markers                                                        | `--write` 1 "damaged markers", note left as it was; `--check` 1 (INVALID)                                                                                                                                       |
| unsupported syntax (`test.only`, a template title, an unbalanced file) | `--write --files` 1 with "unsupported wrapper at line N", "dynamic title at line N", "parse error at line N"; no note created; `--check` reports MISSING                                                        |
| a path with spaces                                                     | `tests/blog/with space/odd.spec.ts` → `vault/tests/blog/with space/odd.md`                                                                                                                                      |
| deleted source with a managed note                                     | `--write --files` 1 "DELETED SOURCE … still exists … Nothing was erased"; `--check` 1 (NO SOURCE); after the reviewed removal of the note: `--write --files` 0 "ok, deleted … has no managed note", `--check` 0 |
| flags and unsafe paths                                                 | exit 2 for unknown, conflicting and misplaced flags; exit 1 with "unsafe or outside tests/" for `../outside.spec.ts`, `pages/BasePage.ts`, `tests/blog/not-a-spec.ts` and an absolute temp path                 |
| `--from-hook`                                                          | a changed supported spec: change-log entry written and the note refreshed (exit 0); an unsupported spec: exit 0, "not refreshed" on stderr, no note (fail-open)                                                 |
| session modes                                                          | `--session-start` and `--session-end` never create a note                                                                                                                                                       |

## Stage 2: link checks and Git integration

- `scripts/validate-vault.mjs` (`npm run vault:validate`): local Markdown links resolve from the note's folder, `[[wikilinks]]` from the vault root; labels, optional `.md` and `#fragment` suffixes handled; targets must exist (fragments and external sites are not checked); images, `http(s)`, `mailto`, fragment-only links and anything inside fenced or inline code are ignored. Broken targets are errors (exit 1). An unlinked maintained note is a warning (exit stays 0); `_map.md`, `_raw/`, `_changelog/`, `sources/` (imports) and `12-progress-report/` (daily entries) are exempt. Imported notes carry no generated-note metadata.
- `.husky/pre-commit` now runs, in order: the secret scan, `vault-precommit.mjs --safety`, lint-staged (Prettier then ESLint, `--concurrent false`), `vault-precommit.mjs --refresh`. The wrapper reads the staged specs from `git diff --cached --name-status -z -M` (NUL-delimited, renames give old and new path), refuses before any write a partially staged spec, a related note with unstaged edits, or an existing untracked note, then calls `vault-sync --write --files … --stage` (which rechecks safety and stages only the corresponding notes; never `git add .`) and `--check` for the present specs. A deleted or renamed spec passes its old path so a leftover managed note stops the commit for reviewed cleanup.
- `.husky/pre-push` keeps the destination check, typecheck and the listing, then runs `vault-sync --check` and `validate-vault`.
- `.prettierignore` excludes `vault/tests/` so Prettier never rewrites a generated block.

Integration proofs (`safety-tests/vault-sync.test.mjs`, a disposable Git repository with a local author):

| Proof                            | Result                                                                                                                                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| partially staged spec            | `--write --files --stage` 1 "partially staged", note unchanged; the wrapper `--safety` 1                                                                                                         |
| related note with unstaged edits | 1 "has unstaged edits"; wrapper `--safety` 1                                                                                                                                                     |
| existing untracked human note    | 1 "exists but is untracked"                                                                                                                                                                      |
| normal staged spec               | note refreshed and staged ("staged 1 note(s)"); an unrelated staged file stayed staged; an unrelated unstaged file stayed unstaged and unchanged; wrapper `--refresh` 0; the commit went through |
| staged deletion                  | wrapper `--refresh` 1 "DELETED SOURCE" while the old note existed; after `git rm` of the note: 0; `--check` 0 after the commit                                                                   |

Validator proofs (`safety-tests/validate-vault.test.mjs`): a vault with valid Markdown links, wikilinks with a label and a fragment, a link into `tests/`, exempt files and links inside a fence and inline code → 0 errors, 0 warnings; a broken local link → exit 1 with `ERROR 03-framework/guide.md: broken markdown -> ../tests/blog/nope.md`, repaired → 0; a broken wikilink → exit 1, repaired → 0; an unlinked maintained guide → warning only, imports and logs never warn.

One real defect found and fixed by these tests: the first validator treated a dotted note name (`home.smoke`) as a file extension and skipped the `.md` fallback, so every wikilink to a spec note was reported broken. The fallback is now tried whenever the target is absent.

## Step 5: the additional validator rule

Rule: warn when a guide under `vault/03-framework/` has no Markdown H1 outside code blocks. Severity: warning, because the guide may still be useful; a warning never changes the exit code. Scope: `03-framework/` only; imports, logs and other notes are outside it. Fixture proof: a guide whose only `#` line sits inside a code fence → `WARN 03-framework/no-heading.md: guide has no H1 heading outside code blocks`, exit 0; after adding the heading → no warning.

## Real-project checks after both stages

| Command                                                     | Result                                                                                                                                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test:safety`                                       | 92 tests, 92 passed (Week 1: 6; recorder and sessions: 14; guard: 29; Stop and preflight: 14; generator and Git integration: 17; validator: 5; plus the earlier Task 05 cases) |
| `npm run lint`, `npm run format:check`, `npm run typecheck` | exit 0                                                                                                                                                                         |
| `node scripts/vault-sync.mjs --check`                       | 4 note(s) fresh, 0 problem(s)                                                                                                                                                  |
| `npm run vault:validate`                                    | 8 file(s), 0 error(s), 0 warning(s)                                                                                                                                            |
| `npx playwright test --list`                                | 5 tests in 4 files; the five `test:` titles in the four notes are the same five titles (a listing proves discovery, not a passing run)                                         |

No executable test code changed in this task; the five-test browser result from Task 10 (`5 passed`) is the current browser evidence.

## Limits

- The notes are refreshed by the pre-commit hook for the specs being committed, by `PostToolUse` for a spec Claude edits, and by `npm run vault:sync` on request. A spec saved in the editor and never committed leaves its note stale until one of those runs; the pre-push `--check` reports it. The optional `FileChanged` watcher stays off.
- The generator supports the syntax the current specs use; a new wrapper needs a generator change, not a workaround.
- Live hook behaviour (the `PostToolUse` refresh in a real session) is not verified in this build.

## Hand run on the real vault (the pre-push check path)

A broken link appended to `vault/_context.md` (`[a note that does not exist](tests/blog/nope.md)`): `node scripts/validate-vault.mjs` printed `ERROR _context.md: broken markdown -> tests/blog/nope.md`, `8 file(s), 1 error(s), 0 warning(s)`, exit 1. After restoring the file: `8 file(s), 0 error(s), 0 warning(s)`, exit 0. The file was restored byte for byte.

## The normal commit

Commit `Task 11: keep spec notes current with freshness and link checks` went through the full pre-commit chain: `secret-scan: 14 staged file(s) clean`, `vault-precommit.mjs --safety` (no staged spec, exit 0), lint-staged (Prettier and ESLint on the staged files), `vault-precommit.mjs --refresh` (no staged spec, nothing to refresh). No note changed during the commit, so this evidence update is the only follow-up.
