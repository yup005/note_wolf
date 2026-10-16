# Local Database Backups Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline; one fresh final reviewer. Owner's continuous implementation/no repeated process questions and current-main batch publication govern execution.

**Goal:** Safe consistent local snapshots and recovery into a new file, with a synthetic recovery drill.
**Architecture:** Focused filesystem/SQLite module, strict command-line adapter, existing package aliases. Current application/server flows remain unchanged.
**Tech Stack:** Node24+, existing better-sqlite3/TypeScript/node:test; no dependencies.
**Spec:** [Design](../specs/2026-10-15-database-backups-design.md).

## Global Constraints

Explicit source/output, readonly live source; snapshot-only DELETE normalization, integrity/FK/core-field/type/primary-key/unique-key validation. Restore requires64-hex SHA-256; inspect accepts optional digest. New private POSIX output only: parent0700/file0600/stage0700, exclusive publication, no overwrite including sidecars/symlinks/concurrent output. Timeout default30000ms/max300000; no source migration/checkpoint/cleanup, no raw content/errors in CLI. No deployment/live DB/3000, backup schedule/retention, off-host provisioning or gameplay changes. Work only synthetic temporary files. Completed batch commits/pushes on current main, preserving source/history.

## Review Focus

1. WAL-only committed data and a concurrent uncommitted transaction must yield a consistent snapshot; Task1 real SQLite drill.
2. Path aliases, dangling links, stale sidecars and two simultaneous publications must not overwrite caller files; Task1 filesystem tests.
3. Corrupt SQLite, FK violations, wrong schema/checksum or a live WAL input must not publish a restore; Task1 rejection/cleanup tests.
4. Raw SQL errors or private test strings must not enter CLI stdout/stderr; Task2 spawned-process tests.
5. Timeout/failed output must remove only owned staging files and preserve the running source; Task1 deadline/failure tests.

### Task 1: Snapshot module and recovery drill

**Files:** new `packages/storage/databaseBackup.ts`, `tests/database-backup.test.ts`.
**Produces:** the exact three async functions, error class and BackupInfo in the spec. No changes to LobbyStore/AuthStore/runtime schemas.
- [x] Write real temp-file tests using sharingFixture and an active room; assert committed WAL data, private modes, complete restored behavior, source isolation, conflicts/hash/integrity/schema/FK/sidecars, concurrent output and deadline cleanup.
- [x] Observe meaningful missing-function RED; implement backup/inspect/restore using SQLite backup, strict validation and exclusive publication.
- [x] Run focused tests; fix observed failures, typecheck/diffcheck and record actual evidence.

### Task 2: Operator commands and documentation

**Files:** new `apps/server/database.ts`, `tests/database-backup-cli.test.ts`, operator documentation `docs/DATABASE_BACKUP.md`; modify package scripts/.gitignore and existing rule/testcase/decision/status/report/progress/matrix/map/README/OPEN_QUESTIONS where relevant.
**Consumes:** Task1 functions; no network access or application administrator endpoint.
- [x] Spawn command RED before adapter; verify strict arguments, checksum-required restore, output privacy/error redaction, actual successful backup/verify/restore and no-overwrite.
- [x] Implement strict adapter and scripts/ignored backup directory. Document operator workflow, digest handling, sensitive backup storage and partial production status.
- [x] Run both focused suites and required full npm test/typecheck/build; inspect scoped diff and sync stable166 IDs/49 historical decisions. No UI changes: browser suite not rerun.
- [ ] One independent whole-change review; fix important findings with failing regressions then green full checks. Update evidence and normal commit/push; SHA followup docs-only, verify final remote SHA.

Commit only at the completed delivery boundary, per owner workflow. Keep useful execution reports; no cleanup of other plans' artifacts. Written spec/plan and in-place implementation proceed under the owner's standing authorization instead of repeated artifact-approval prompts.

Final local checkpoint:14focused pass, full518pass/0fail/0skip29.7s, typecheck/buildpass; one fresh review and one P2 fix wave with4RED→GREEN schema regressions. No browser rerun for this command-only batch. Publication/remote proof is recorded after Git operations in the final response/local execution ledger; this file records its pre-publication checkpoint.
