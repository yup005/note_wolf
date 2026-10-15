# Personal record permanent deletion

Status: implementation design; 2026-10-14. Source: [Owner decision 2](../../PRODUCT_DECISIONS.md#owner-decisions-2026-10-12), H-004 and ADMIN-008. Owner's standing continuation/no-repeat-confirmation instruction applies to development; no live data deletion or deployment is authorized by this design.

## Outcome and boundaries

An author can permanently erase their saved private draft and all their published versions for one game after a second confirmation. Guests can erase their own session-owned records; registered authors retain this right after VIP expiry. Administrators cannot erase another author's private records. Official adopted facts, other authors' records, the game archive and game-level comments survive.

Expose a lazy homepage "我的记录" entry (including records whose runtime room was cleaned), and a "永久删除我的记录" action in the existing editor whenever an own draft exists. Confirmation explains that saved/unsaved personal content and all own published versions are removed, related shares become unavailable, official facts/other authors/comments remain, and recovery is unavailable. Cancel performs no write. Deleted personal drafts are not silently recreated by reading; authorized recorders may explicitly choose "新建记录" with a fresh identity and empty private notes.

## Interfaces

- GET `/api/my-records` -> `{items:OwnRecordSummary[]}` for the current authenticated session only. Summary: `id,roomId,code,revision,publishedVersion,withdrawn,official,versionCount`. No draft text, other owners or share tokens.
- POST `/api/records/:id/delete` -> `{deleted:true}`. Strict body: `{requestId:UUID,confirmed:true,revision:nonnegative integer,publishedVersion:positive integer|null,withdrawn:boolean}`. All three state fields must match the saved target. A changed draft/publication/withdrawal rejects with `STALE_RECORD`; other owners/missing targets return `NOT_FOUND`. Exact same actor/request/target/body retry succeeds without another mutation; reused request ID with another command fails. Recheck session authorization before receipt lookup.
- POST `/api/rooms/:id/record/create` with `{requestId:UUID,confirmed:true}` -> `RecordDraft`. Only an eligible participant recorder; retries must not recreate a later-deleted generation. New generations have fresh UUIDs and revisions above deleted generations to reject old room-scoped save/publish/commit requests. Initial untouched record-list behavior stays compatible.
- `RecordPostSummary.deleted?:boolean` enables participant favorites to retain their entry/name/date while showing "已永久删除" and excluding deleted text from search. External favorites retain their entry, name and date, with original credentials scrubbed and original authority permanently unavailable.

## Storage and privacy

Use one atomic transaction. Delete published bodies and version-source rows, erase private draft content and related share credentials. Retain only minimal tombstone metadata needed by foreign-key favorites, original authorization denial, delete receipts and prevention of automatic recreation. Previously public author attribution is retained for published favorites' title/author/date; unpublished tombstones scrub author. Tombstones must never be publishable, editable, readable by old URLs, or share-regenerable; a new record never revives old IDs/tokens/favorites.

Official records are independent facts. Before erasure of an official author record, capture the canonical official document into an independent snapshot with empty notes, including legacy archives whose only remaining canonical source is an old published official version; never substitute unadopted draft edits. Existing host notes copied into `manual_games`, `manual_revisions` or `record_official_snapshots` must be erased when the host deletes their personal record, while factual fields, outcomes, revisions and attribution remain. New official adoption/snapshots should store facts with `notes:''`; personal notes remain exclusively in personal drafts/versions. Do not erase another author's notes. Outstanding, unadopted end requests originating in an erased personal record must not retain that source's personal document; track source identity rather than trusting nicknames.

Account binding must migrate deletion blockers/receipts together with existing ownership, so guest deletion does not resurrect after login. Independent live records conflicting with deleted generations in either binding direction reject atomically using existing RECORD_ACCOUNT_CONFLICT. In-room private UI remounts on session changes. Survives DB restart and runtime cleanup. SQLite logical erasure is the promise; historical external backups/browser copies are not rewritten or represented as securely wiped bytes.

## Verification

Synthetic DB tests must prove actual body erasure, official fact preservation, other authors/comments unchanged, expired-VIP/guest ownership, authorization denial including old sessions, stale publication/draft checks, exact retry/payload binding, new generation isolation, binding/restart/runtime cleanup, and favorites/search/sharing/community invalidation. HTTP tests cover strict inputs/query rejection, own-only projection and socket privacy. Browser tests cover cancel, confirm, lost response/retry, stale dialog, homepage archived deletion, expired VIP, explicit new record, 320/390/430px layout and keyboard access.

Delivery requires full unit/typecheck/build/E2E, independent review and documentation updates with stable requirement IDs. Push a coherent verified batch on current main per project workflow; do not deploy or claim physical iPhone acceptance.
