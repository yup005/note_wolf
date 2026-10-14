# Published replay comments and moderation design

2026-10-13, owner continuation after the delivered judge batch. Source: H-003/H-004, SOCIAL-001–008, PRODUCT_DECISIONS first round23–26. User says all allowed and do not ask again; routine implementation design proceeds under that authorization. This is a new subsystem integrated with existing published-record/share authority, not a game-rule change.

## Intent and boundary

Let participants and valid-link external readers discuss a finished published replay and reply to one another. All authors/versions of one archived game share one thread. Anonymous valid-link readers can read; active logged-in accounts can interact without VIP. Each request revalidates its original record/share/favorite authority; knowing a game/comment ID never grants access. Private drafts, unpublished notes and in-progress secret actions remain unreachable. Comments never receive live game Socket broadcasts.

Implement comments, nested replies, folding, root pagination and latest/hot/oldest ordering, irreversible game/comment likes, reporting and the minimum superadmin moderation loop in one verified batch. Include own account warnings/penalty messages (30-day display), since penalties require user-facing evidence. Full update/reply/like subscriptions/notification center and account-wide operation logs beyond community actions remain later work. Default optional notifications stay off. No deploy, record deletion or gameplay change.

## Architecture and authority

New strict community contracts and CommunityStore use SQLite tables referencing independent record_rooms and accounts, so discussion survives runtime room cleanup/restart. An injected resolver calls existing RecordsStore.post, SharingStore.read or SharedFavoritesStore.read on every read/write and returns only the authorized archived room internally. Public scope is {kind:'record',id} | {kind:'share',token} | {kind:'shared-favorite',id}; no arbitrary room scope/admin override. Admin sees reported/public comments and community audit, never record drafts or private game payloads.

Read API is POST /api/community/read with scope, sort, parentId, cursor, limit; no session creation for anonymous share reads. POST /api/community/comment, /like, /game-like, /report require an existing active logged-in session, current scope authorization, and request UUID. Body/query injection is rejected. GET /api/community/me is own account restriction/messages. GET /api/admin/community/reports and /audit, POST /api/admin/community/action require superadmin plus current report and target comment/restriction versions, confirmation, request UUID and reason. No edit/delete author API.

## Persistence and behavior

Comments have UUID, room, author account, parent/root IDs, creation time and deletion/version state. Body technical limit2000 Unicode characters, trimmed nonempty plain text; UI renders text, never HTML. Community v1 displays nicknames and returns null avatar URLs to avoid exposing author account UUIDs; existing profile/room avatars remain unchanged. Parent must belong to authorized room and not be deleted; cycles impossible because parent preexists and no edits. Root threads paginated20 (max50); direct-child pages oldest first and arbitrary-depth reply support without loading the whole tree. Root latest/oldest sort by creation+UUID; hot by aggregate live thread comment likes then creation+UUID. Opaque validated keyset cursor bound to room/parent/sort, never containing credentials. Concurrent heat changes can reorder, UI deduplicates returned node IDs.

Deleted parent is a public tombstone with empty body, retains children/counts; no new reply/like/report on deleted nodes, surviving descendants work normally. Source moderation record preserves target and operator/reason; original public comment text remains staff-only for audit, not in public tombstones.

Game likes UNIQUE(room,account,LosAngeles calendar date), total cumulative. Comment likes UNIQUE(comment,account) lifetime. Both cannot unlike; same request/duplicate like is idempotent and does not double count, across devices/author versions. Reports UNIQUE(comment,reporter), mandatory reason<=500 chars; pending content stays visible. Muted account cannot post/reply or like comments; can report misconduct and like games, and all normal game operations remain unchanged. This is a documented engineering ruling about comment-only restrictions, not new game policy.

Moderator actions dismiss, delete, warn, temporary mute (future until), permanent mute (null until), unmute. Reports remain with review status/version; no appeal. Single existing superadmin, no added staff role. Deletes preserve children. Every action includes actual operator, target, reason, timestamp, request identity and state version; duplicate retries do not apply twice, stale requests reject. Report-targeted actions validate both report version and targetVersion (comment for delete, restriction for account effects), preventing old report tabs overwriting newer sanctions. Target restriction persists until expiry/unmute, private account warning/penalty messages display for30days without deleting audit or game history.

## Mobile interface

Existing published record dialog, shared page and shared-favorite dialog embed a lazy comment entry. Expand to list comments, choose sort, load root/child pages, reply, like and report. Logged-out users see login entry using existing AccountDialog; no anonymous cookie until deliberate login. Input remains on transient failures; version changes preserve same game discussion. On background/auth failure/scope loss, clear rendered community content; foreground explicitly refreshes original authority before revealing, with generation/abort guards against late responses.

AdminPanel gains 评论审核 tab for reports, mandatory reason, explicit action confirmation, deleted-parent handling and audit. Existing user management can open comment restriction status and warn/mute/unmute without disabling game account. AccountDialog shows own moderation messages and active comment restriction. Only valid actions are presented, no raw JSON editor.

## Verification and boundaries

TDD actual DB/domain + HTTP/Socket/session tests, synthetic12-client publication/share fixtures, UI lifecycle/responsive320/390/430 and XSS-as-text. Revocation/VIP expiry/regeneration/withdrawal/disabled account and favorite original-authority tests; duplicate/stale/cross-game/forged parent/cursor inputs; deep replies/pagination/sorting/deleted ancestor; DST LA-day likes; temporary mute expiry and game independence; restart/runtime cleanup. Mandatory full npm test/typecheck/build/full E2E, independent review, docs/progress/166 stable IDs, scoped main commit+SHA followup, normal push/remote equality. Real iPhone/VoiceOver/network/device acceptance remains pending.
