# Mechanical Boards M0–M2 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline execution; one independent review at the delivery boundary. Owner explicitly authorizes continuing each stage after verified commit/push.

**Goal:** Complete the baseline, reusable board configuration workflow and durable engine framework before connecting new gameplay.

**Architecture:** Extend existing lobby/preparation with public composition snapshots and a private owner-scoped template library. Keep the existing 12-player runtime unchanged. New versioned engine state is internal, validated and durable; no HTTP endpoint or public projection exposes it.

**Tech Stack:** Node 24, TypeScript, Zod, SQLite, React, existing Playwright suite.

**Spec:** [M0–M6 specification](../../CODEX_MECHANICAL_BOARDS_IMPLEMENTATION.md), [mechanical rules](../../MECHANICAL_WOLF_SEER.md), [armor rules](../../MECHANICAL_ARMOR.md).

## Global Constraints

- Preserve all existing 12-player features, architecture and privacy boundaries; no 九尾/白泽.
- No guessed gameplay defaults; unresolved interactions return/record blocked-by-product-decision.
- New configurations can be saved/selected before the new gameplay runtime is available; dealing/start rejects unsupported boards explicitly.
- New public composition contains counts, never seat identities or abilities. System presets are immutable; account/guest templates belong to their owner.
- Publish on current main by completed milestone with npm test/typecheck/build and relevant browser checks; never merge a PR without owner authorization.

## Review Focus

- Shrinking seat counts cannot silently evict an occupied seat; reject atomically.
- Old settings revisions, started rooms and non-hosts cannot change the game composition.
- Existing database migration preserves identities, ready flags, memberships, accounts and foreign keys.
- A saved template update cannot change an existing room snapshot; another owner cannot read/update it.
- Durable engine state must preserve copy provenance and inventory, reject stale writes and fail closed on unsupported versions without broadcasting secrets.

### M0: Baseline and source reconciliation

- [x] Read all linked rules, inspect existing modules, record existing/missing/conflicting behavior in the implementation progress table.
- [x] Run npm test, typecheck/build and full E2E baseline; preserve previous foundations and incoming source history.
- [x] Record full foundation implementation SHA; publish M0 documentation plus previously verified foundation delivery at this boundary.

### M1: Public configuration and private library

Files: contracts/board.ts, domain/boardConfig.ts, storage/boards.ts, storage/lobby.ts, storage/preparation.ts, storage/auth.ts, contracts/index.ts, server/app.ts, web/BoardConfigurationPanel.tsx, PreparationPanel.tsx, RoomLobby.tsx; tests/board-store.test.ts, board-server.test.ts, e2e/boards.spec.ts.

- [x] Write red regressions for preset immutability, private saved configurations, guest/account linkage, restart, room snapshot independence, dynamic seats, invalid/duplicate role counts, stale/locked/unauthorized updates and unsupported start gate.
- [x] Implement BoardTemplate and RoomBoardSnapshot with explicit ruleVersion and configuration, a revisioned SQLite owner library, public room composition snapshots and safe legacy seat migration.
- [x] Expose authenticated library APIs and host-only board selection; reset preparation on valid configuration changes without evicting players.
- [x] Add collapsed mobile editor for template preview, derive/edit/save/reload and selection; preserve standard-board one-screen preparation controls.
- [x] Red→green browser coverage for 13/15/zero wolf configurations, reload, fixed template isolation and new-board gate; full tests/typecheck/build/E2E, docs and milestone commit/push.

### M2: Durable engine framework

Files: contracts/engine.ts, domain/engine.ts, storage/engine.ts, domain/skills.ts; tests/engine.test.ts, engine-store.test.ts.

- [ ] Red tests for role/camp/mimic separation, independent copy inventory and nested parameters, locked event provenance, no death at submission, unresolved settlement, duplicate-death prevention and restart/stale-write/version validation.
- [ ] Implement strict versioned Role/Ability/NightEvent/RuleSet/Resolution/Victory state schemas with source/time/public-state provenance. Add explicit strategy interface that cannot settle unimplemented rules by default.
- [ ] Implement internal SQLite snapshot store with optimistic revision and fail-closed validation, no HTTP/admin/public secret access.
- [ ] Verify restart restores independent charges/lastTarget/copy history, full npm/type/build checks and public-leak regression; update milestone matrix, docs, implementation SHA and push.

## Execution ledger

- Preflight: clean main at 3d9d3b7 ahead 5; fetched 5bba4d1 (three new documentation commits). Normal merge 4874f83 preserves both histories; document index conflict resolved retaining both spec and existing design, correcting the remote literal newline.
- Ruling: use the owner-authorized current branch workflow instead of creating another worktree; preserve committed local foundations.
- Ruling: M1 exposes board preparation/storage, not unfinished gameplay. M3–M5 implement dealing/night/day for new boards; the server gate prevents accidental legacy runtime use.
- blocked-by-product-decision: simultaneous armor victory remains contradictory (unified §4 versus detailed armor record); no gameplay selection in M0–M2. Extra knife inheritance/target choice is confirmed in this chat and supersedes unified §7 item 2 for that subset.

- M1 verification complete:6 new unit/integration and1 new browser test; full184 +35, typecheck/build pass. Review P2 readiness fixed; old DOM selector ID preserved. SQLite snapshot initialization/backfill red→green. Publication follows owner workflow.
