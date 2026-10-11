# Project progress

## Current: duplicate favorites repair (2026-10-10)

RECAP-006 maintenance: FavoritesPanel and MySharesPanel used the same sibling React key. Separate key prefixes prevent orphan favorites panels after account transitions. Regression reproduced before the fix and passed after it. Verified the exact delivery source in an isolated copy: npm test196/196, typecheck/build pass, full Chromium E2E37/37 (including three login/logout cycles). Other profile/retention/mechanical edits remain local and are excluded from this delivery. Physical iPhone Safari remains unverified. See [test evidence](TEST_REPORT.md).

## Current: local development and seat text repair (2026-10-10)

Fixed stale backend/frontend contract mismatch, source watch paths and graceful Vite/HMR shutdown before HTTP shutdown. Local test console remains available through dev:test; production remains disabled. Seat names/tags no longer shrink vertically. Full unit226 (including30 pending separate mechanical-domain checks), typecheck/build and full browser36 passed; targeted5 passed. Localhost/LAN HTTP200 verified from this computer; physical phone/LAN acceptance pending. See [test evidence](TEST_REPORT.md). Original local database and sessions retained.

## Historical: 2026-10-10 authorized integration

Owner authorized merging [PR #1](https://github.com/yup005/note_wolf/pull/1). GitHub confirms it is merged at `ac186c1c92e8cdbd45dc1d7bcc3762013745342c`; local `main` was fast-forwarded and the remote SHA checked. The feature branch remains available. Incoming mechanical-wolf discussion updates were retained, with no game implementation. Code/tests/build configuration match the previously verified snapshot; this integration did not rerun code tests. Progress/provenance changes receive document/link/diff checks and normal commit/push. Physical-device acceptance remains outstanding.

## Historical: 2026-10-10 workflow initialization

Branch: `codex/preparation-dealing`. Safely integrated remote collaboration documents from `fc21863` while preserving local development. Saved the pre-existing code/docs in [`a6332eeea7ce4fbcb92b4f87e0b370b6fc3fb915`](https://github.com/yup005/note_wolf/commit/a6332eeea7ce4fbcb92b4f87e0b370b6fc3fb915). This task added no game feature or new rule; it only configured the standing workflow and maintained documentation, with two empty-line whitespace cleanups.

Fresh verification: 156 server tests and 34 Chromium mobile-viewport tests passed (zero failures/skips), typecheck and production build passed. Physical iPhone Safari, real voice/multiplayer, background/lock-screen, weak networks and public deployment remain unverified. Full current status, requirement references and remaining issues: [PROJECT_STATUS_FOR_CHATGPT.md](PROJECT_STATUS_FOR_CHATGPT.md). Future completed tasks update that record; the following ledger is historical.

## Historical lobby ledger — docs/superpowers/plans/2026-10-09-werewolf-lobby.md

User authorized native continuous execution. Current branch `work` in managed task workspace; no main/master edits or external publication.
Pre-flight: Store methods feed HTTP and socket public projections; UI consumes same contracts. No conflicting interfaces.
Ruling: use current managed work branch, not a nested checkout, to keep deliverable in the user's workspace. Cost: changes reside in current work branch.
Ruling: persist ledger in docs because skill helper files are cloud resources, not installed executable files. Cost: manual phase tracking.

Task 1: complete — dependency installation, SQLite foundation test and typecheck passed. Sandbox disallowed local IPC; scripts use node --import tsx and network-granted test calls.
Task 2: complete — six real SQLite tests passed (including 10,000-code exhaustion and persistence). Initial RED: missing storage implementation.
Task 3: complete — two real HTTP/socket tests passed; full suite 9/9. Initial RED: missing server module. Typecheck exposed UUID inferred type; requestId is explicitly string to match validation contract.
Task 4: implementation built successfully. Browser RED: no index/UI; first functional run exposed decorative plus in create button accessible name. Fixed aria-label without changing visible copy.
Task 4: complete — three Chromium end-to-end cases passed: 3 independent UI contexts realtime synchronization, OTP deletion/paste and warning-once, 12 independent API contexts full capacity. Refresh and offline/reconnect included.
Final review: independent reviewer review_lobby found one important issue: lost create response + reload forgets pending request key. Reproduced against real Chromium, fixed by persisting key and original payload, retaining on error and clearing only on confirmed success. Regression passed.
Final review: corrected copy button to ≥44px per design; clarified L-03 temporary name input validation is not a confirmed product rule; expanded real service restart test to verify session cookie + websocket membership.
Final: minor (deferred): plain HTTP LAN clipboard API may be unavailable; room number remains visible and manually copyable.
Final: minor (deferred): no browser injection test for deliberately delayed older websocket snapshot; revision guard is implemented, service and browser state convergence verified.
Task 5: complete — final suite 10/10, typecheck, production build, browser E2E 4/4 all passed. Production compiled-bundle browser smoke returned HTML 200 and successful create/seat with no page errors. Test evidence and explicit limitations saved in TEST_REPORT.md; screenshots inspected and retained. No publish/push/merge performed.
