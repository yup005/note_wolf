# Personal Record Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Preserve shared checkout; root owns final verification/docs/commit/push.

**Goal:** Authors can permanently erase their personal game records without deleting adopted official facts or other people's content.

**Architecture:** Extend existing records storage with atomic erasure, minimal tombstones and idempotent author-only commands. Add a reusable confirmation dialog and lazy own-record list; all existing share/favorite/community readers continue validating original authority.

**Tech Stack:** Existing TypeScript/SQLite/Express/React/Playwright; no new dependencies.

**Spec:** [Deletion design](../specs/2026-10-14-personal-record-deletion-design.md).

## Global Constraints

- Use the exact endpoints/types in the spec; deletion works without VIP and never grants administrator access.
- Preserve official factual history/other authors/comments; no live data deletion, deployment or secrets in artifacts.
- Root publishes current-main coherent batch only after all required checks; agents do not commit/push.
- User already instructed uninterrupted execution; no repeated process permission questions.

## Review Focus

- Lost acknowledgement followed by unrelated actions and retry must bind to the exact original deletion.
- A stale room writer must not modify an explicitly recreated record generation.
- Guest-to-account binding must preserve deletion and not revive drafts.
- Historical official documents must lose deleted personal notes but retain adopted facts.
- Old shares/favorites/community scopes must remain unavailable after recreation/restart.

### Task 1: Author-only atomic erasure and wire contracts

**Files:** contracts/records.ts; storage/records.ts, auth.ts, lobby.ts, sharing.ts as needed; server/app.ts; new tests/record-deletion.test.ts and tests/record-deletion-server.test.ts. Own backend/contracts only.

**Interfaces:** All endpoints, strict body fields and summary names in the spec. Expose matching LobbyStore wrappers. Deleted summaries mark `deleted:true`; existing readers must reject tombstones. Share/favorite/community access remains original authority.

- [x] Write failing domain/wire tests for erasure, stale state, auth, idempotency, new generations, official histories, binding/cleanup/restart, favorites/community.
- [x] Run focused tests and record meaningful RED evidence.
- [x] Implement atomic storage and HTTP contracts; migrate legacy tables without discarding data. Remove notes from new official adoption while preserving private editor notes.
- [x] Run focused tests/typecheck; inspect scoped diff, report risks/evidence. No Git mutations.

### Task 2: Own-record entry and confirmation flow

**Files:** new web MyRecordsPanel.tsx, RecordDeleteDialog.tsx; App.tsx, RecordsPanel.tsx, api.ts and styles as needed; new e2e/record-deletion.spec.ts. Own frontend/E2E only.

**Interfaces:** Consume Task 1 spec endpoints and summary. Session revision key remounts private list. Dialog receives summary/state, shows exact deletion boundary, holds immutable UUID/body through ambiguous retries, closes/clears private input only after success. Definitive stale/auth errors cannot reuse stale authority. Explicit recreation uses create endpoint.

- [x] Write failing synthetic browser tests for cancel/confirm/home entry, expired VIP, lost response/retry, stale confirmation, cleared editor/new generation.
- [x] Capture RED evidence once backend is ready; implement lazy homepage entry and reusable accessible confirmation.
- [x] Verify synthetic mobile widths 320/390/430 and keyboard access, full flow, and regression isolation. Preserve unrelated editor behavior. No Git mutations.

### Task 3: Independent review and coherent delivery

**Files:** docs rules/tests/status/report/progress/matrix/map/README/OPEN_QUESTIONS as applicable; root ownership.

- [x] Fresh review checks both spec and actual backend/UI diff; resolve blockers with regressions.
- [x] Run npm test/typecheck/build and full Chromium E2E in synthetic isolated environment.
- [x] Update ADMIN-008 evidence and stable 166-ID matrix; review links/anchors, diff and preservation of historical decisions.
- [x] Prepare the verified scoped delivery for the standing current-main Git workflow; root records the implementation SHA in the status/report followup and verifies the remote after normal push.

## Execution ledger

Baseline `e510f52951f235aea4bae6f26a6fc2066d25c6c5`, clean main synchronized after fetch. Tasks 1/2 share only the specified interfaces and can proceed independently; task 3 consumes both. UI uses optional deleted flag compatibly with existing summaries. Root will keep actual verification results here before publication.

## Executed verification — 2026-10-14

Full unit475/475; typecheck/build pass; full Chromium81/81 (5.4m). Independent review found no remaining P1/P2 after favorite metadata, both archived binding directions and canonical legacy fallback fixes. Existing judge checks now distinguish private inference from factual revision. Requirements166 IDs retained; ADMIN-008 now locally implemented. Current status/report own the complete evidence and publication SHA; no deployment or physical-device acceptance.
