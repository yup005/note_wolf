# Temporary judge and automatic return implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development for isolated tasks, with root integration and independent review. The owner authorized continuous implementation without repeated approvals; publish one verified batch on current main, not per step.

**Goal:** Finish the confirmed temporary-judge, private supplementation, validated manual-to-automatic return and ordinary-seer mimic feedback.

**Architecture:** Keep ordinary host/admin/public projections unchanged. Store an explicit versioned judge appointment and private audited supplementation draft. Reuse existing night/day commands on a frozen shadow runtime rather than accepting arbitrary engine JSON or inventory edits. Apply a checked draft atomically, preserving the automatic checkpoint, official facts and completed abilities; restore the chosen phase paused with a full default timer and existing five-second resume.

**Tech stack:** Existing TypeScript/SQLite/Zod/React/Playwright, Node24+. No new dependency or deployment.

**Spec:** PRODUCT_DECISIONS.md fourth round47–49 and third round42–46 override older manual-return/judge pending notes; second round37 controls seer feedback. Existing rule timings, privacy and unresolved-engine gates remain binding.

## Global constraints

- Judge candidate must be publicly dead with death skills completed; ordinary hosts/admins get no private judge projection without a current explicit appointment.
- Automatic candidates are verified against public death and pending skill tasks. Pure manual deaths require recorded public death and explicit host completion attestation, audited as a manual fact, since no automatic skill queue exists.
- Judge cannot regain player interjection/vote/explosion/secret-skill rights; may manage public flow and supplement only while manual/paused. Revalidate session, membership and appointment on every read/write.
- Supplementation uses existing validated commands and phase advances, freezes timers, records actual judge identity privately, and cannot rewrite pre-switch completed automatic actions.
- Return requires current manual/appointment/draft versions and explicit confirmation. Reject ended/pending requests, no-wolf boards, unresolved rules or public fact mismatch. Preserve manual history, notes and published versions. Old turn IDs must be stale after restoring.
- Full default current-phase timing on return; completed submissions/inventory remain. Pause/resume uses existing5s preparation. Night-only speech and standard12 remain compatible.
- Full npm test/typecheck/build/E2E, independent review, documentation sync and normal push+remote SHA verification. Physical iPhone/audio/multi-phone acceptance remains separate.

## Review focus

1. Revoked/replaced judge, old account sessions and administrators must lose secrets; no public/Socket/admin/voice payload includes judge private data.
2. Pending hunter/white-wolf/death tasks or unpublished night deaths cannot nominate a judge. Manual completion attestation must never override a live automatic queue.
3. Interrupted/repeated/stale supplementation or return must be atomic and cannot duplicate commands, inventory, night resolution or record history.
4. Daytime/extra-night/dual-idiot/poisoned wolves and pure-manual starts must reuse confirmed mechanics, never manufacture unknown outcomes.
5. Private notes remain author-only; official/manual facts, automatic history and immutable versions survive return/restart.

### Task1: Ordinary seer mimic feedback

**Files:** packages/domain/engine.ts/mechanicalEngine.ts/mechanicalAbilities.ts and packages/contracts/engine.ts; tests/seer-mimic.test.ts.

- [x] Write failing actual-runtime regressions for mechanical/armor good mimic, wolf mimic, real mixer and unchanged true victory camp.
- [x] Use confirmed copied-role feedback for ordinary seer only; spirit-seer precise inspection remains distinct.
- [x] Run scoped tests and independent review; root integrates without overwriting other work.

### Task2: Explicit judge authorization and private checkpoint

**Files:** packages/contracts/judge.ts, packages/storage/judge.ts, packages/storage/control.ts/lobby.ts/day.ts/night.ts, apps/server/app.ts, tests/judge.test.ts and wire tests.

**Interfaces:** Public RoomSnapshot.judge = {seat:number|null,version:number,candidates:number[]}; JudgePrivate with versioned draft, current public night/day projections, role/skill inventories, per-seat private stage cards and official facts without notes. Host appointment POST /judge/appoint; appointed member GET /judge/private. Both reject query/body injection and use existing session/member authorization. JudgeStore provides canManage/isJudge checks to existing control/public operations.

- [x] RED appointment/public-death/pending-skill/privacy/revocation/session tests.
- [x] Persist assignment/audit, validate current membership and completed public deaths, expose only public assignment metadata and protected explicit private projection.
- [x] Reject player actions for judge while retaining public host operations, pause/resume, night voice and phase advance.
- [x] GREEN scoped/wire tests; review eligibility and privacy before UI integration.

### Task3: Frozen supplementation and checked return

**Files:** packages/contracts/judge.ts, packages/domain/judge.ts, packages/storage/judge.ts/records.ts, tests/judge.test.ts and tests/judge-wire.test.ts.

**Interfaces:** POST /judge/draft starts a private frozen checkpoint (from preserved automatic runtime or pure-manual initial runtime); POST /judge/supplement accepts versioned actorSeat + existing NightCommand/DayCommand or advance/enter-night/enter-day, never raw state; POST /judge/return atomically validates draft/manual/assignment versions and official facts before restoring paused automatic runtime. Responses use JudgePrivate; return uses normal LobbyView. All carry explicit versions/request identity; preserve source history and actual operator audit.

- [x] RED standard/mechanical inventory, pure-manual reconstruction, stale/duplicate/race/restart/public-fact mismatch and full-timer tests.
- [x] Shadow replay existing domain commands, merge only canonical public facts that agree with official record, never notes; retain all completed automatic state and supplementary audit.
- [x] Validate before atomic apply, change turn token without losing stored commitment receipts, remove active manual runtime only after success, keep archival/manual revisions, resume with full phase duration.
- [x] GREEN scoped/wire tests and independent review.

### Task4: Mobile judge controls and delivery

**Files:** apps/web/src/JudgePanel.tsx, JudgeControls.tsx/judgeActions.ts/ManualPanel.tsx/NightPanel.tsx/DayPanel.tsx/RecordsPanel.tsx/gameAccess.ts, style.css; tests/e2e/judge.spec.ts; current docs/status/report/matrix/README.

- [x] RED mobile host nomination + appointed player private panel, supplementation/return/revocation and non-judge privacy flows.
- [x] Add clear nominee and death-skill confirmation controls, a judge-only private panel with role inventories and human-readable phase/command forms; no JSON/code editing in user flow.
- [x] Verify320/390/430px screenshots and complete lifecycle, full tests/build/E2E, final independent review.
- [x] Sync confirmed rules/status/IDs/history, scoped commit+SHA doc follow-up; prepare normal push and remote SHA check. No deployment.

## Execution notes

2026-10-13 preflight: clean main a93ebd0eef291025ed165a170104b8f0c858aae6; fresh fetch0/0. Existing manual record switch preserves runtime but resets controls; no judge or return exists. The owner accepted the recommended core-flow batch. Scope excludes comments, permanent deletion, notifications and deployment.


Execution rulings: missing official facts mean unknown and may be filled by validated canonical replay; existing facts must remain a compatible ordered subset, true conflicts fail atomically. Previously ended manual games cannot reopen; a new legal computed terminal reached within supplementation may return as ended with existing domain victory. Recorded manual public death plus explicit audited completion may appoint while the original automatic queue is frozen; live automatic queues remain ineligible, and return proves all previous judges remain dead. New seer receipts carry server-owned mimic-camp-v1, untagged historical receipts retain prior feedback. Review found ongoing historical death-cause disclosure and foreground auto-reveal; both require regression/fix before delivery. Existing player interjection must stop on judge appointment.

Final verification: root npm test441/441 (29.0s), typecheck/build pass; full Chromium mobile E2E63/63 (4.4m). Independent final review no blockers after privacy/interjection fixes. Main bundle502.49KB with500KB warning, JudgePanel19.64KB lazy. Physical-device/audio acceptance remains pending.

Implementation commit: ac5b79795ee04267e5e961fda978d07a39575511; this documentation-only SHA follow-up does not change verified code. Publication and final remote equality are checked after committing this follow-up and reported in the delivery response.
