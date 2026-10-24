# Database access

Dev database only, through the restricted `postgres` connector in `.mcp.json`, with the login issued to this student. This file has no `paths` restriction on purpose. The access facts matter in every conversation that touches the database.

## Approved route

- What: Claude reads the database only through the `postgres` MCP server (`uvx ... postgres-mcp --access-mode=restricted`, see `.mcp.json`). `uvx` loads `.env` into the connector's environment and the connector reads `DATABASE_URI` from there. A `DATABASE_URI` already set in the shell or OS environment wins over `.env`. `.mcp.json` holds no credential and no `env` block.
- What: the login lives in `.env` as two equal lines, `STUDENT_DATABASE_URL` and `DATABASE_URI`. Claude never reads `.env` and never prints a connection string (`01-guardrails.md`). Scripts may read it (Task 07).
- When: dev only. The course team issues the login for the dev database only. Production stays read-only for every tool.
- Check: `git check-ignore .env` prints `.env`; `git ls-files .env` prints nothing.

## Approved reads

- What: metadata (`information_schema`, `pg_catalog`) and row counts. Seed records named by id or slug are planned for Task 07 and not yet exercised. Never personal row values: no `email` or `password_hash` values from `users`, no comment author emails.
- What: no write of any kind through the connector or a test: no `insert`, `update`, `delete`, no DDL (statements that change table structure), no role or grant change, no `truncate`, and no reset of shared data. Other students use the same database.
- Check: database code in this project contains no `insert`, `update`, `delete`, `truncate`, `alter`, `drop`, `create` or `grant` statement. A privilege name inside an inspection call such as `has_table_privilege(..., 'UPDATE')` is not a statement.

## Two fences, and what stays unverified

| Layer                       | What it does                                                                                                                                   | State on 2026-10-24                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Connector (restricted mode) | `postgres-mcp` runs with `--access-mode=restricted`; its `execute_sql` tool is described as "Execute a read-only SQL query".                   | Verified: tool list and nine read-only `execute_sql` calls succeeded. Not verified: no write statement was sent, so its refusal is not proven. |
| PostgreSQL grants           | The issued role is a member of `qa_student`; the grants decide what a statement may do once it reaches the database.                           | Verified by inspection: `has_table_privilege` and the system tables read below. No mutation was attempted.                                     |
| Outside the connector       | Through `psql` the role could write the 11 blog and store tables; the grants allow it. The connector is the fence that keeps Claude read-only. | Not tested. The Task 07 scripts inspect privileges; they do not attempt writes either.                                                         |

## Expected permissions

Source: the course team's login-message wording of 2026-10-19, read on 2026-10-24 together with the issued login. No Slack message was received in this build. The issued matrix wins over older ticket wording. A ticket that expects a different right is a question for the mentor, not a reason to probe.

- Blog tables (`articles`, `categories`, `comments`) and store tables (`products`, `product_variants`, `coupons`, `carts`, `cart_items`, `orders`, `order_items`, `payments`): read, add, change, delete.
- `users`: read and add only. No change, no delete.
- Sequences: usable.
- Table structure, logins and roles, `TRUNCATE`, superuser: nothing.

## Observed on 2026-10-24 (read-only metadata through the connector)

| Check                                  | Expected                                                                                      | Observed                                                                                                                                             | Match |
| -------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `current_user`, `session_user`         | the issued role                                                                               | `student_tsarukoles`, database `codemify_sandbox`, PostgreSQL 16                                                                                     | yes   |
| Role attributes                        | no superuser, no create role or database, no replication, no right to skip row-level security | `rolsuper` f, `rolcreaterole` f, `rolcreatedb` f, `rolreplication` f, `rolbypassrls` f, `rolinherit` t, `rolcanlogin` t                              | yes   |
| Memberships                            | `qa_student`                                                                                  | `qa_student` only                                                                                                                                    | yes   |
| Ownership                              | owns nothing                                                                                  | 0 tables; all 12 public tables are owned by the application's own role                                                                               | yes   |
| Schemas visible                        | `public` plus the two system schemas                                                          | `information_schema`, `pg_catalog`, `public`                                                                                                         | yes   |
| Tables in `public`                     | 12                                                                                            | `articles`, `cart_items`, `carts`, `categories`, `comments`, `coupons`, `order_items`, `orders`, `payments`, `product_variants`, `products`, `users` | yes   |
| Grants on the 11 blog and store tables | SELECT, INSERT, UPDATE, DELETE                                                                | SELECT, INSERT, UPDATE, DELETE true; TRUNCATE false on every table                                                                                   | yes   |
| Grants on `users`                      | SELECT, INSERT                                                                                | SELECT true, INSERT true, UPDATE false, DELETE false, TRUNCATE false                                                                                 | yes   |
| Sequences                              | usable                                                                                        | 12 of 12 have USAGE                                                                                                                                  | yes   |
| Structure changes                      | none                                                                                          | CREATE in schema `public` false; CREATE on the database false                                                                                        | yes   |
| User count                             | none: shared data drifts. The seed list dated 2026-10-15 says 4, as a reference only          | 4 on 2026-10-24                                                                                                                                      | n/a   |

No elevated right was found. Counts drift as students work. The date next to a count is part of the fact.

## One expected denied operation (privilege inspected, nothing attempted)

`UPDATE` on `users`: `has_table_privilege(current_user, 'public.users', 'UPDATE')` is false, so PostgreSQL would reject a row change in `users` for this role. No update was attempted, and the restricted connector's own refusal was not exercised.

## Connector facts (2026-10-24)

- Runtime: uv 0.11.7, Python 3.12.13, `postgres-mcp` 0.3.0, `mcp` 1.30.0, `pglast` 7.21. Nine tools: `list_schemas`, `list_objects`, `get_object_details`, `explain_query`, `analyze_workload_indexes`, `analyze_query_indexes`, `analyze_db_health`, `get_top_queries`, `execute_sql`.
- Deviation from the course command: `postgres-mcp` 0.3.0 pins `pglast==7.2.0`, a version PyPI no longer serves (the 7.x line keeps only 7.20 and 7.21). The course command therefore fails to resolve. `.mcp.json` adds `--overrides uv-overrides.txt` (one line, `pglast==7.21`); the Python 3.12 and `mcp~=1.0` choices stay. Without the override, Python 3.13 falls back to `postgres-mcp` 0.1.0, which has no `--access-mode` flag (inferred from the resolver output: 0.1.0 is the only release that allows Python 3.13 and does not pin `pglast`). Remove the override once a connector release without the dead pin is published.
- How the connection was verified: a scripted MCP client (a small script that starts the server exactly as `.mcp.json` declares it, lists its tools and sends the reads) ran the nine reads above on 2026-10-24. The VS Code `/mcp` "Connected" screen was not observed in this build. The setup lesson's Step 5 block was run on 2026-10-24: it printed "Database login: both lines found and equal" and `select current_user` printed the issued role. Its two result lines were read in the terminal and are not stored in the repository.
- `psql` was installed with winget, command-line tools only, no database server.

## Limits and next steps

- Metadata reads prove permissions on the day they ran. They do not prove that a write is refused; nothing here attempted one.
- The connector's restricted mode and the grants are two separate fences. A change to either needs a new inspection, not an assumption.
- Task 07 adds the repeatable scripts (`scripts/verify-student-fence.sh`, `scripts/seed-integrity.sh`) that repeat the privilege inspection and the seed counts from the command line. Until then this file is the record.
