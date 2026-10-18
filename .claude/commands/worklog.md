---
description: Append today's work journal entry (Did / Worked / didn't / Next) to vault/12-progress-report/<you>/<date>.md. The Stop reminder points here.
argument-hint: "[optional note to seed the entry]"
---

Append a short, honest entry about this session's work to today's journal file.

## 1. Find the file

Run `node scripts/hooks/stop-worklog.mjs --path` and use the path it prints. Do not derive the path yourself; the Stop reminder builds it with the same code, so the two can never disagree. Create the folder and the file if they do not exist.

## 2. Gather what actually happened

- Read `git status`, `git log --oneline -5` and today's `vault/_changelog/<date>.md` if it exists.
- Use only work that happened in this session or since the last entry. Never record an action that did not happen.

## 3. Append the entry

Add this block at the end of the file. Use the real local time for the heading (`## HH:MM`, 24-hour clock). Keep every earlier entry exactly as it is; the journal is append-only.

```md
## HH:MM

- **Did:** the substantive actions, files or areas, and results (green or red).
- **Worked / didn't:** one honest line each.
- **Next:** the first thing the next session should do.
```

## Guardrails

- Never include secrets: no tokens, passwords, connection strings or `.env` contents. The journal is committed.
- Short and useful: a teammate should learn what moved in about five bullets, not a transcript of prompts.
- If `$ARGUMENTS` was given, use it as a seed for the entry, not as the whole entry.

When the entry is written, a normal Stop passes: `scripts/hooks/stop-worklog.mjs` sees the `## HH:MM` heading and exits 0.
