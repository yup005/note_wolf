# Local database backup and isolated recovery

Scope: BETA-010 / GAP-06 local tooling, under the owner's continuous implementation instruction. Baseline main e60c1bae5d191086f2bcaa4ec367c2c7db800df6 was clean, freshly fetched, with no incoming commits. No deployment, paid storage, backup scheduling/retention policy, live-data operation or gameplay change.

## Outcome

Provide explicit operator commands to create a consistent standalone SQLite snapshot, inspect it, and recover it into a **new** file. Prove recovery using synthetic accounts, active seats/private phase, official facts, published history, unpublished draft and favorites. Formal production BETA-010 stays partial: off-host storage, frequency, recovery targets and production recovery remain unconfigured.

Use the installed better-sqlite3 online backup API, rather than copying a live database file or adding a network service. An archive bundle and in-place restore add unnecessary failure modes; one standalone database plus a SHA-256 recorded separately provides the minimal local recovery unit. Sources: [better-sqlite3 API](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md#backupdestination-options---promise), [SQLite backup](https://sqlite.org/backup.html).

## Interfaces and files

`packages/storage/databaseBackup.ts` exports:
- `backupDatabase({source,output,timeoutMs?}): Promise<BackupInfo>`; default timeout30000ms, positive integer <=300000. Source is an explicit existing regular file; open read-only, never instantiate LobbyStore/migrate/clean runtime data. Online backup goes into a private staging directory in the target parent. Convert only the snapshot to DELETE journal mode for self-contained portability, then validate it.
- `inspectBackup({source,sha256?}): Promise<BackupInfo>`; requires a standalone DELETE-mode snapshot with no `-wal`, `-shm`, `-journal` siblings. Check SQLite integrity, foreign keys and minimum application core fields/types/primary keys and required full unique keys; compare the optional64-hex checksum. Return metadata only.
- `restoreDatabase({source,output,sha256}): Promise<BackupInfo>`; checksum required. Copy the input into private staging, validate the **copied** bytes/checksum before publishing. No in-place replacement or service start. A live WAL database is not a restore archive; create a proper backup first.
- `BackupInfo={path:string;sha256:string;bytes:number;schemaVersion:number}`; typed `DatabaseBackupError` with fixed error codes, no database content/raw SQL exception in operator output.

`apps/server/database.ts` implements strict commands `backup`, `inspect`, `restore`; package aliases `db:backup`, `db:verify`, `db:restore`. Require explicit `--source`; backup/restore require `--output`; restore requires `--sha256`. Reject unknown/duplicate/irrelevant/missing options, memory/blank paths and malformed checksums. Optional `--timeout-ms` is backup-only. JSON success metadata / fixed Chinese error message, nonzero on failure; never print contents, credential/session values, raw exceptions or stacks. No dependencies, HTTP endpoints or browser UI.

## File safety and failure behavior

- Only trusted local filesystem operators use these commands; application administrator rights do not grant access. Backups contain all private data and are not public exports. `.backups/` is ignored, and docs require private storage outside any served web directory.
- Create new output parents with0700; existing output parent must be private on POSIX (no group/other permissions). Output file0600, staging directory0700. The supported tested environment is local macOS/Linux POSIX; unsupported permission semantics must fail clearly rather than claim privacy.
- Reject existing destination and any sidecars, including dangling symlinks. Publish a validated, closed, flushed staging file with an exclusive hard link in the same parent filesystem; EEXIST never overwrites a concurrent destination. Cleanup only the staging directory created by this operation, never a caller's file or source.
- No final output is visible until validation succeeds. Check source/destination path shapes, regular files/symlinks, source existence, output conflict, foreign-key errors, bad SQLite/wrong application schema, live WAL archive and checksum mismatch. Errors leave source and existing destination intact; concurrent exports to one destination have exactly one winner.
- Online backup progress checks its deadline (plus SQLite's bounded busy wait); failures abort and remove partial staging data. No implicit retries, rotation, backup deletion or source checkpoints/migrations.
- Source reads and snapshots preserve all existing tables, original source authorization and receipts. The snapshot is local, unencrypted secret material; it does not rewrite older external backups when the application later deletes a record. External storage/encryption/retention require their own configuration.

## Verification

Meaningful RED before implementation. Real WAL source with an open writer and uncommitted transaction; backup includes committed facts and excludes uncommitted rows. Compare table rows and exercise restored application APIs for accounts, active seats/night state, private draft, publication/history/favorites. Verify source remains unchanged and restored writes do not affect it. Real filesystem tests pin private modes, existing/hard/symbolic-link/sidecar conflicts, concurrent destination, invalid/truncated/foreign-key-invalid database, wrong hash, cleanup and deadline. Spawn actual CLI for success and invalid options; no raw synthetic private strings in output. Full npm test/typecheck/build, scoped diff/docs checks, one independent whole-change review. No browser tests needed for this command-only change; no physical or production recovery claim.
