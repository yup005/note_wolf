# Codex project instructions — note_wolf

## Project context
- This is a mobile-first, in-person Werewolf assistant ("笔记狼人杀"), optimized for iPhone Safari.
- Read `docs/PRODUCT_DECISIONS.md` before making product-rule decisions.
- Read `docs/NOTE_WOLF_PRODUCT_REQUIREMENTS_MATRIX.md` if present; it is the product requirement index, not proof of implementation.
- The older `README.md`, `docs/WEREWOLF_RULES_SPEC.md`, `docs/WEREWOLF_TEST_CASES.md`, `docs/PROGRESS.md`, and `docs/TEST_REPORT.md` may describe earlier revisions. Resolve discrepancies using later explicitly confirmed product decisions, and verify actual implementation against the current checked-out code and tests.
- **Do not implement 九尾/白泽 board** unless the user explicitly reopens that scope.
- Never invent gameplay rules. Mark unresolved rules and ask for a decision before implementing that behavior.
- Do not mistake Chromium/mobile viewport simulation for physical iPhone Safari acceptance.

## Standing Git workflow preference (authorized by project owner)
After **each completed user-requested development or documentation task**:
1. Inspect the current branch, remote, `git status`, and scoped diff. Preserve all unrelated or pre-existing user edits.
2. Run relevant verification before publication. For code changes use `npm test`, `npm run typecheck`, `npm run build`, and relevant `npm run test:e2e` when available/applicable. If any step cannot run, say so explicitly; do not claim it passed.
3. Stage **only files belonging to the completed task**, review the staged diff, and do not include credentials, .env files, tokens, local database, generated output, or other secrets.
4. If task changes and checks are in a publishable state, create a descriptive git commit **and push to `origin` on the current branch as part of the task**. The owner does not need to repeat "commit and push" each time.
5. When on `main`, use a normal non-force push. On a task/feature branch, push that branch and create/update a PR to `main` when appropriate; **do not merge a PR without specific authorization**.
6. Never force-push, silently reset, overwrite divergent remote history, bypass hooks, or resolve conflicting unrelated edits by discarding data. On conflict, unclear upstream, failing checks, or permission denial, stop the affected publication step and report the exact blocker. Ask for platform approval only when required.
7. Report branch, commit SHA, tests actually run, and GitHub link at the end.

This preference applies when Codex is actually running a task; it does **not** create a file watcher, background agent, or autonomous push when Codex is closed. Platform/network permission prompts can still appear.

## Product documentation sync
- Product decisions from the ChatGPT conversation are maintained in `docs/PRODUCT_DECISIONS.md`. Codex cannot automatically read unsynced ChatGPT conversation history; use the committed documents.
- If a user task changes a confirmed rule or feature, update the matching docs and relevant tests in the **same task**. Do not mark an item "implemented" until code and test evidence support it.
- Keep "confirmed", "proposed", and "unresolved" explicitly separate.
- This is a public repository. Never copy private conversations, personal details, passwords, tokens, private player notes, or live secret game information into its docs.
