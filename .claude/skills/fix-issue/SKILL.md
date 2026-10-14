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
- Tests and typecheck: see `.claude/CLAUDE.md` (test command with the transform flag; the typecheck's known failing count, where only a change in the count is a regression).

## 3. Workflow (one step at a time, in this order)

1. **Explain** the problem in plain terms: what the code does, why it is wrong, who hits it in real use. Cite `file:line`.
2. **Reproduce it for real** in the Browser pane against the real API, when the issue is user-visible. Show the before state (screenshot plus a hard number, e.g. request count or seconds spinning). If it can't be reproduced, say so plainly. That is a valid outcome and may mean the issue doesn't need fixing; ask the user how to proceed.
3. **Nuances and options.** List the trade-offs and edge cases, recommend one option, and **ask the user with AskUserQuestion**. Don't write the fix before they answer. Also say what is deliberately left out of scope.
4. **Test first.** Add a regression test that describes the correct behaviour. Run it on the unfixed code and show that the bug cases fail (and correct-behaviour cases pass). If a unit test can't meaningfully guard the issue (e.g. dependency or build problems), say so and propose the right guard instead.
5. **Fix**, matching the surrounding code style (comment density, naming, indentation as in the file).
6. **Verify**: the new tests pass, the full test suite passes, the typecheck count is unchanged, and the same browser scenario now works (show the after numbers).
7. **Ask before committing.** Show `git diff --stat` and a proposed commit message (imperative subject; body explains the bug and the fix). Commit only after an explicit yes, and only the files for this issue. If the user asks for changes to be reverted, also restore anything installed or generated along the way.
8. **Wrap up** with a short summary: commit hash, what changed, test names, and anything discovered that affects other issues or makes `.claude/CLAUDE.md` out of date. If this session was started from a coordinating session (e.g. from a brief), tell the user to take that summary back to it.

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

Trajectory and topology downloads in the viewer (`src/hooks/use-viewer-data`) use `stream-http` / `https-browserify` (Node-style `http.request`), not axios. In modern browsers `stream-http` streams with `fetch`, not XHR, so the XHR patches above may not catch them. Check `window.__log` first, and patch `window.fetch` the same way if needed.

Unit tests for hooks: see `src/hooks/use-api/index.test.js` for a controllable fake axios (`requests[]`, `respond()`, `fail()`, unique URLs per test because the hook keeps a module-level map).
