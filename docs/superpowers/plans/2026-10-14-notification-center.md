# Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or executing-plans. Root owns docs, full checks and standing current-main publication; agents never commit/push/deploy.

**Goal:** Complete an account-owned notification center with opt-in social reminders and preserved original source authority.

**Architecture:** One NotificationsStore for inbox/settings/receipts/seen versions, transactionally connected to existing source mutations. Lazy UI with source readers and exact comment focus reuses current views.

**Tech Stack:** Existing TypeScript/SQLite/Express/React/Playwright, no dependencies.

**Spec:** [Notification design](../specs/2026-10-14-notification-center-design.md).

## Global Constraints

- Fixed types/endpoints from the spec; optional subscriptions off, mandatory account/moderation on.
- Protect live secrets/private notes and original share authority; no deployments/real data.
- Preserve baseline main/local work. User authorizes continuous execution and current-main publication after all required checks; no repeated approval questions.
- Backend owns contracts/storage/server/unit; frontend owns web/E2E. Fixed interfaces permit parallel implementation. Root resolves boundaries and publication.

## Review Focus

- Optional source replay after toggling on or clearing must not resurrect old messages.
- Original commenter source belongs to recipient, never the replying actor's token.
- New arrivals and merged likes after list watermark survive stale read-all/clear.
- Cleared/expired migrated moderation notices cannot reappear after restart.
- Inbox availability checks cannot mark favorites seen or transfer share access.

### Task 1: Transactional sources and notification contracts

**Files:** new contracts/notifications.ts, storage/notifications.ts, tests/notifications.test.ts and notifications-server.test.ts; existing auth/lobby/community/favorites contracts/server as needed. Backend ownership only.

**Interfaces:** Implement exact NotificationSettings/Item/Page/Target and routes from spec. Lobby wrappers: notificationsList(token,query), notificationSettings(token,input), notificationCommand(token,input), notificationOpen(token,id), cleanupNotifications(); communityFocus(token|undefined,input). Frontend consumes FavoriteItem.hasUpdate and focusCommentId.

- [x] Write failing domain/wire tests proving source timing, per-owner authority, fixed expiry/cleanup, cursors/watermark, retry binding, recipient source, own mandatory migration, favorite update/seen behavior and binding.
- [x] Capture RED; implement focused store, migrations, strict routes, transactional source hooks and maintenance. No new record/game secret projection.
- [x] Run focused tests/typecheck, self-review against spec; report changed files/counts/limitations. No Git mutations.

### Task 2: Mobile notification center and source focus

**Files:** new NotificationBell/NotificationCenter/NotificationTarget/CommentFocus components and notification CSS as needed; App/AccountDialog/CommunityNotices/FavoritesPanel/reader dialogs/CommunityEntry; new e2e/notifications.spec.ts plus minimal existing E2E expectation updates if UI entry moves. Frontend ownership only.

**Interfaces:** Exact Task1 spec endpoints; NotificationTarget scope/focus; readers accept optional focusCommentId; CommunityEntry auto-opens authorized focus; CommentFocus uses community/focus and clears on loss. Favorites show optional hasUpdate and refresh after actual read. AccountId/session-keyed private state. Keep current comment drafts on normal version refresh.

- [x] Write browser cases for defaults/settings, generated reply/likes/update+unread, original-source revocation/focus, mandatory notice, read/delete/bulk/clear, committed JSON503 exact retry, stale settings/bulk, session hiding, 320/390/430 and keyboard/44px.
- [x] Capture meaningful missing-entry RED before UI implementation; request runner from root, never compete with fullsuite.
- [x] Implement lazy center/targets/settings with immutable retry intents, loading/error/revalidation guards; retain current restriction UI while message history uses shared center.
- [x] Run scoped browser/type checks and inspect synthetic screenshots. Report precise real-vs-mocked boundaries. No Git mutations.

### Task 3: Review, docs and verified delivery

**Files:** root owns rules/testcases/decision/status/report/progress/matrix/map/README/OPEN_QUESTIONS.

- [x] Fresh independent review of source privacy, owner-scoped state, migration/expiry, original-link destination and UI retry/races; resolve blockers with regressions.
- [x] Run full npm test/typecheck/build/full Chromium E2E against isolated3100/in-memory. User localhost3000 untouched.
- [x] Update NOTICE-001–005 evidence, current account-notice scope and actual matrix totals; retain166 IDs and historical49 decisions. Document limits and doc/link/diff review.
- [ ] Prepare scoped current-main commit, SHA followup and normal push; verify final remote SHA per workflow. No deployment.

## Execution baseline

Clean main fa9eecb9fc6d37348a034641d352adbbe18f622d; fetch succeeded and no divergence/incoming requirements. Existing community/records/deletion complete; develop missing notification module only. Task1/2 share fixed contracts only, Task3 consumes both. Root maintains a per-plan ignored ledger for resumption.

## Verification outcome

Final root unit494/494 (21.7s), typecheck/build pass; full Chromium87/87 (6.6m), narrow9/9 (24.3s). Independent review closed with no blockers after pagination-watermark, exact-token shared-read acknowledgement and retained-intent account precondition fixes. Delivery docs retain166 IDs and49 historical decisions. Final current-main commit/push and SHA verification follow in the same delivery batch; no deployment or physical-device claim.
