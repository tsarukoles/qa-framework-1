#!/usr/bin/env node
/**
 * scripts/vault-sync.mjs — the project recorder (Week 2, Task 05).
 *
 *   node scripts/vault-sync.mjs --from-hook      read one Claude Code hook event (JSON on stdin) and
 *                                                append one entry to vault/_changelog/<local date>.md
 *   node scripts/vault-sync.mjs --session-start  append "- session START <UTC time>" to
 *                                                vault/_changelog/sessions.log
 *
 * Project root: VAULT_SYNC_ROOT (isolated tests), else CLAUDE_PROJECT_DIR (Claude Code sets it for
 * hook commands), else the current working directory. Claude Code runs hook commands with the
 * project folder as the working directory, which is also what makes the relative command
 * "node scripts/vault-sync.mjs" resolve. A session started one folder up loads no project hooks.
 *
 * Logging modes always exit 0, including on a write failure, which is reported briefly on stderr
 * without the input contents. Node built-ins only.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

const ROOT = resolve(process.env.VAULT_SYNC_ROOT || process.env.CLAUDE_PROJECT_DIR || process.cwd());
const VAULT = 'vault';
const CHANGELOG_DIR = resolve(ROOT, VAULT, '_changelog');

/** Runs one git command in the project root; returns its trimmed output or the fallback. */
function git(args, fallback) {
  try {
    const result = spawnSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const out = result.status === 0 ? (result.stdout || '').trim() : '';
    return out || fallback;
  } catch {
    return fallback;
  }
}

function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function localDate(now = new Date()) {
  const two = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}`;
}

function forwardSlashes(p) {
  return p.replace(/\\/g, '/');
}

/** Reads all of stdin, strips every leading byte-order mark and parses JSON. Null when unreadable. */
function readHookInput() {
  let raw;
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    return null;
  }
  raw = raw.replace(/^﻿+/, '');
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The project-relative, forward-slash path for a hook payload path.
 * Null when the value is missing, malformed, outside the project, the vault folder, or inside it.
 */
function projectPath(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return null;
  const absolute = isAbsolute(raw) ? resolve(raw) : resolve(ROOT, raw);
  const rel = forwardSlashes(relative(ROOT, absolute));
  if (rel === '' || rel === '..' || rel.startsWith('../') || isAbsolute(rel)) return null;
  if (rel === VAULT || rel.startsWith(`${VAULT}/`)) return null;
  return rel;
}

function appendLine(file, text) {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, text, 'utf8');
}

function modeFromHook() {
  const payload = readHookInput();
  if (!payload) return 0;
  // PostToolUse (Edit|Write) carries tool_input.file_path; FileChanged carries a top-level file_path.
  const rel = projectPath(payload.tool_input?.file_path ?? payload.file_path);
  if (!rel) return 0;
  const who = `${git(['config', 'user.name'], 'unknown')}@${hostname() || 'unknown'}`;
  // symbolic-ref names the branch even before its first commit; rev-parse covers a detached HEAD.
  const branch = git(['symbolic-ref', '--short', 'HEAD'], git(['rev-parse', '--abbrev-ref', 'HEAD'], 'unknown'));
  const why = git(['log', '-1', '--format=%s'], 'unknown');
  // The short ID of HEAD when the recorder ran: the saved version the edit started from.
  // It does not mean that commit contains the edit; the edit is usually still uncommitted.
  const commit = git(['rev-parse', '--short', 'HEAD'], 'unknown');
  const entry =
    `- **when:** ${utcNow()} · **who:** ${who} · **branch:** ${branch}\n` +
    `  **what:** ${rel} · **why (last commit):** ${why} · **commit:** ${commit}\n`;
  appendLine(resolve(CHANGELOG_DIR, `${localDate()}.md`), entry);
  return 0;
}

function modeSessionStart() {
  appendLine(resolve(CHANGELOG_DIR, 'sessions.log'), `- session START ${utcNow()}\n`);
  return 0;
}

const modes = { '--from-hook': modeFromHook, '--session-start': modeSessionStart };
const mode = process.argv[2];
if (!modes[mode]) {
  console.error('usage: node scripts/vault-sync.mjs --from-hook | --session-start');
  process.exit(2);
}
try {
  process.exit(modes[mode]());
} catch (err) {
  console.error(`vault-sync: ${mode} could not write its record (${err?.code ?? 'error'})`);
  process.exit(0);
}
