# Administrative oversight implementation plan

**Goal:** Complete missing ADMIN-005–007 and Owner27 public-share oversight, preserving current gameplay/privacy and source authorization.
**Spec:** [Design](../specs/2026-10-14-admin-oversight-design.md). Existing TS/SQLite/Express/React/Playwright only, no dependencies.

## Global Constraints

- Only current active super-admin; admin oversight/CSV is explicit management metadata, no body/tokens/unpublished/game secrets. Legacy moderation review remains separately authorized.
- Strict filters, signed dataset/filter-bound stable cursor; reports grouped percomment with distinct reporters and whole-group counts. CSV identical filtered projection, formula safe, allmatch<=5000 or explicit409.
- Direct AuthStore actual state writes plus audit/notifications share transaction. Repeated identical state has no log; preserve old routes. Legacy community history is unified from real records, no fabricated VIP history.
- Revoke needs reason/confirmed/currentrevision/immutableUUID/expectedAdminId. Auth before receipt, atomic link+log+message+receipt; replay never revokes a regenerated link. Original share favorites stay old-source scoped.
- User authorizes continuous current-main implementation/publication without repeated process approval. Source-preserving no reset/stash/forcepush, no deployment/live3000. Source workers sequential, no worker commits/children. Root owns docs/fullchecks/Git.

## Review Focus

1. Export formula/control-prefix injection and silently truncated5001 matches; tests pin exact CSV safe metadata/limit.
2. Cursor reused with another dataset/filter, literal SQL wildcard names and equal timestamps; test strict binding/stablepages.
3. Real aggregate counts after individual report review, date/status filtered groups with repeated reporters; test whole-group semantics.
4. Direct AuthStore calls and failure inside log callback; test no state/notification mutation survives rollback, legacy audit stillvisible/no manufactured history.
5. Current admin receipt replay after revocation and old share action after regeneration; test exact precondition/idempotency/authorization/atomic sources.

### Task 1: Backend oversight and safe contracts

**Files:** new packages/contracts/admin.ts, packages/storage/adminOversight.ts, tests/admin-oversight.test.ts, tests/admin-oversight-server.test.ts; modify auth/lobby/server and error mapping as needed. Backend ownership; no web/docs edits.
**Interfaces:** exact spec exports/types and Lobby wrappers/endpoints. AuthStore optional structured actual-admin-change callback integrated within direct mutation transactions. Export/list projection shared, not duplicated.

- [x] Write failing domain/wire tests for real grouped reports, filters/cursors/CSV, source privacy/currentadmin and direct audit/revoke lifecycle; observe meaningful RED before implementation.
- [x] Implement focused store/schema/transactional hooks and strict routes, preserving existing APIs/retention. Named safe projections; no arbitrary JSON/body selection for export.
- [x] Run new + adjacent auth/community/sharing/notification tests and typecheck/diffcheck; report exact outputs and limits in this plan's workspace. No commit/push/deploy.

### Task 2: Existing backend UI integration

**Files:** new apps/web/src/AdminOversightPanel.tsx and adminOversight.css (additional small focused helpers if needed); modify AdminPanel/App only as needed; new tests/e2e/admin-oversight.spec.ts. Frontend ownership after Task1 review.
**Interfaces:** consumes Task1 fixed spec routes/types; props {adminId:string;onReviewReports:()=>void}; AdminPanel receives current account id/session identity from App for safe remount, existing features preserved.

- [x] Real synthetic fixture browser missing-entry RED. New tabs/filters/paging/CSV use applied filters, report overview links existing moderation.
- [x] Revoke reason/cancel/confirm, exact retained retries expectedAdminId+revision; conflict reread, no hidden auto-resubmit. Hide/revoke/account guards and delayed reads; no pending action at unverified owner state.
- [x] Scoped browser checks real sources/counts, active/private views absent, export metadata/formulas, committed503 and source revoke/regen, mobile44px/keyboard. Capture/view synthetic screenshot. Type/diffchecks and report; isolated3100 runner allocated by root only.

### Task 3: Independent review and verified delivery

**Files:** root rules/testcases/decisions/status/report/progress/matrix/map/README/OPEN_QUESTIONS.
- [x] Independent backend review before UI, final whole-change review; implementer fixes with regression evidence, reviewers reread scoped fixes.
- [x] Full npm test/typecheck/build/isolated full Chromium, preserve existing production limits and tests; no live3000.
- [x] Sync source-preserving docs/166 stableIDs/49 historicaldecisions and actual statuscounts, link/diff checks. Full implementationSHA followup.
- [ ] Current-main normal commit/push, refetch/compare, verify remoteSHA exact; final report no deployment/device claims.

Final integrated evidence: npm test504/504(25.2s), typecheck/build pass, all96 Chromium pass(7.9m). Three production P2 fixes plus related focus edge and fixture corrections independently approved. Source limits/guards preserved; actual failure history and physical-device limits are in the report. Remaining publication checkboxes describe this file’s pre-publication checkpoint; exact remote verification is recorded by the controller after Git publication.

Implementation commit: [2ff92e379d0cb147786d21ad6fb8ad0818b1e895](https://github.com/yup005/note_wolf/commit/2ff92e379d0cb147786d21ad6fb8ad0818b1e895). SHA followup changes documentation only; code tests are not rerun for it. Exact remote publication is verified after these commits are pushed, then recorded in the final response and local execution ledger.
