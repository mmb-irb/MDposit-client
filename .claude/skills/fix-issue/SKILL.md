---
name: fix-issue
description: Fix one bug or problem in the MDDB client step by step and interactively with the user - explain it, reproduce it for real in the browser, agree on the fix and its nuances, write a failing regression test, fix, verify, and commit only with permission. Use when the user types /fix-issue, describes a bug or misbehaviour in the client and wants it fixed, or asks to work on a numbered issue brief.
argument-hint: "[issue number | path to a brief | description of the problem]"
---

# Fix one issue

Fix **one** issue at a time, keeping the user in the loop at every decision. The issue can come from:

- **A brief number** (e.g. `/fix-issue 3`): read the matching file in `issues/` next to this skill (e.g. `issues/03-*.md`).
- **A path** to a brief or notes file: read it.
- **A description** in the arguments or earlier in the chat ("the browse page shows duplicates when..."): use it.
- **Nothing**: ask the user to describe the problem (what they did, what they expected, what happened, which page or entry, which host).

Whatever the source, treat the description as a hypothesis to confirm, not a fact. Briefs written from code audits have been partly wrong before (e.g. a "bug" in a field nothing reads). If the code or the reproduction says otherwise, tell the user.

## 1. Understand and locate

- Restate the issue in one or two sentences and confirm it with the user if the description was vague.
- Find the responsible code (search; read the relevant files). For a chat-described issue, say where you think the cause is before going further, with `file:line`.
- If it turns out to be several independent problems, list them and ask which one to do first. Note the others for later instead of fixing them in the same change.

## 2. Setup

- Work in the client repository root (the folder with this `.claude/` directory and `package.json`). Check `git status` and the current branch first.
- Branch: use the branch named in the brief. Otherwise, if on `master`, propose a new local branch (`fix/<short-slug>`) and create it once the user agrees. If already on a feature branch, ask whether to continue on it.
- Note any uncommitted changes that were there before you started (e.g. a local edit to `src/default-host-config.js` pointing the dev server at a specific node). They belong to the user: never commit, revert or stage them. Never use `git add -A` / `git add .`; stage files by name.
- Check which node the dev server talks to: `HOST_CONFIG` in `src/default-host-config.js` (or a `src/host-config.js` override). Some behaviour only exists on the global node (`global: true`), so make sure the target fits the issue, and ask the user before changing it.
- Dev server: start it with the Browser pane's `preview_start`, using the dev-server entry in `.claude/launch.json` (create one that runs `npm run start` if there is none). If one is already running, reuse it.
- Tests and typecheck: `npm test -- --run [path]` runs the tests once, and `npm run typecheck` should report 0 errors. See `.claude/CLAUDE.md` for the gotchas.

## 3. Workflow (one step at a time, in this order)

1. **Explain the real issue**, then stop.
   - **Open with the actual problem in one or two sentences**, stated concretely: what goes wrong, under which condition, and the consequence. E.g. "`project-browser/row.js` imports `project-manager`, which imports NGL statically, so the Browse page downloads ~1.2 MB of viewer code it never runs." No preamble, no background first.
   - Then the mechanism, step by step, with the real names: files (`file:line`), functions, requests, chunks, events. Technical terms are fine. Make them concrete (which request, which file, how many bytes or seconds) rather than abstract or simplified. No analogies, no "in plain words" rewording.
   - Who hits it in real use, and how often.
   - If the brief or audit was wrong about something, say so here.
   - Complete but not padded: cover what the user needs to follow the rest, with no repetition or filler.
   - **End your turn there.** Don't put setup questions, reproduction or options in the same message. Wait for the user before going on to setup and step 2. In step 3, describe each option concretely too: what changes in the code and what changes for users.
2. **Reproduce it for real** in the Browser pane against the real API, when the issue is user-visible. Show the before state (screenshot plus a hard number, e.g. request count or seconds spinning). If it can't be reproduced, say so plainly. That is a valid outcome and may mean the issue doesn't need fixing; ask the user how to proceed.
3. **Nuances and options.** List the trade-offs and edge cases, recommend one option, and **ask the user with AskUserQuestion**. Don't write the fix before they answer. Also say what is deliberately left out of scope.
4. **Test first.** Add a regression test that describes the correct behaviour. Run it on the unfixed code and show that the bug cases fail (and correct-behaviour cases pass). If a unit test can't meaningfully guard the issue (e.g. dependency or build problems), say so and propose the right guard instead.
5. **Fix**, matching the surrounding code style (comment density, naming, indentation as in the file).
6. **Verify**: the new tests pass, the full test suite passes, the typecheck count is unchanged, and the same browser scenario now works (show the after numbers).
7. **Ask before committing.** Show `git diff --stat` and a proposed commit message (imperative subject; body explains the bug and the fix). Commit only after an explicit yes, and only the files for this issue. If the user asks for changes to be reverted, also restore anything installed or generated along the way.
8. **Wrap up** with a short summary: commit hash, what changed, test names, and anything discovered that affects other issues or makes `.claude/CLAUDE.md` out of date.
9. **Hand back (optional).** If the work belongs to a coordinating session, offer to send it the summary instead of the user copying it. You know there is one when the brief or the user names it, or when `ListAgents` / `list_sessions` shows a session whose title says it coordinates this work (e.g. "MDDB client audit (coordinator)"). Ask the user first, saying which session you'd send it to. Then send only the summary from step 8 with `SendMessage` (`to`: that session's name or `local_...` id), with a first line that stands on its own, e.g. "Issue 3 fixed and committed (abc1234): ...". Don't send transcripts or long details; the point is to keep the coordinating session small. If there is no coordinating session, or the user declines, just leave the summary in this chat.

## Techniques that worked

Entry `bsc-A0008` (Pyruvate kinase, Trajectory tab at `#/id/bsc-A0008/trajectory`) is a good real test case on the global node (`mdposit-dev.mddbr.eu`). On other nodes, pick an entry from the Browse page.

To make page loads deterministic, load Home first, reload, then patch XHR **before** navigating with `location.hash` (a hash change doesn't reload the page, so the patch survives):

```js
// Delay one endpoint (simulates a slow federated node)
const o = XMLHttpRequest.prototype.open, s = XMLHttpRequest.prototype.send;
window.__log = [];
XMLHttpRequest.prototype.open = function (m, u) { this.__u = u; return o.apply(this, arguments); };
XMLHttpRequest.prototype.send = function () {
  const x = this, a = arguments; window.__log.push(x.__u);
  if (/\/references$/.test(x.__u)) setTimeout(() => s.apply(x, a), 8000); else s.apply(x, a);
};
location.hash = '#/id/bsc-A0008/trajectory';
```

```js
// Fail an endpoint once with a real network error
const o = XMLHttpRequest.prototype.open; window.__log = []; let failed = false;
XMLHttpRequest.prototype.open = function (m, u) {
  if (!failed && /\/references$/.test(u)) { failed = true; window.__log.push('FAILED ' + u); arguments[1] = 'http://127.0.0.1:9/unreachable'; }
  else window.__log.push(u);
  return o.apply(this, arguments);
};
```

Then inspect `window.__log` to count requests. "Leave and come back" means setting `location.hash = '#/browse'`, waiting, then setting it back.

Trajectory and topology downloads in the viewer (`src/hooks/use-viewer-data`) use `stream-http` / `https-browserify` (Node-style `http.request`), not axios. They are POSTs that `stream-http` sends with `fetch`, not XHR, so the XHR patches above don't catch them. On the global node they are 307-redirected to the federated node. Patch `window.fetch` instead:

```js
// Fail the viewer's structure download once with a network error (use a 404 URL for an HTTP error)
const f = window.fetch; window.__log = []; let failed = false;
window.fetch = function (input, init) {
  const u = typeof input === 'string' ? input : input.url;
  if (!failed && /\/structure$/.test(u)) { failed = true; window.__log.push('FAILED ' + u); return f.call(this, 'http://127.0.0.1:9/unreachable', init); }
  window.__log.push(u);
  return f.apply(this, arguments);
};
```

Unit tests for hooks: see `src/hooks/use-api/index.test.js` for a controllable fake axios (`requests[]`, `respond()`, `fail()`, unique URLs per test because the hook keeps a module-level map).
