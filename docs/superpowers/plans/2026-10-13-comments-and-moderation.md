# Comments and moderation implementation plan

> Use superpowers:subagent-driven-development with disjoint ownership, root integration and fresh independent review. Owner authorizes continuous implementation and coherent verified auto-push on current main; no repeated process approvals. Clean preflight main2b4072693b827fe0719992e56e9b7488abf34a86, fresh fetch0/0; no preexisting changes. Shared current checkout is the declared delivery preference, preserve all work.

**Goal:** Deliver usable comments on published records/valid shares with minimum moderation/privacy closure.
**Architecture:** Independent archived-game community tables + original-scope authorization resolver; strict versioned/idempotent commands; lazy plain-text mobile UI and private moderation messages. See [design](../specs/2026-10-13-comments-and-moderation-design.md).
**Stack:** Existing Node24/TypeScript/SQLite/Zod/React/Playwright; no new dependency, no deploy.

## Shared interface contract

CommunityScope = {kind:'record',id:UUID}|{kind:'share',token:64hex}|{kind:'shared-favorite',id:UUID}.
CommunityRead = {scope,sort:'latest'|'hot'|'oldest',parentId:UUID|null,cursor:string|null,limit:number<=50}; defaults latest/null/null/20.
CommunityPage = {items:CommunityComment[],nextCursor:string|null,gameLikes:number,gameLikedToday:boolean,viewer:CommunityViewer}.
CommunityComment = {id,parentId,rootId,author:string,avatarUrl:string|null,body:string|null,createdAt,deleted:boolean,version:number,likes:number,liked:boolean,reported:boolean,childCount:number}.
CommunityViewer = {account:{id,nickname}|null,canInteract:boolean,restriction:{version:number,until:number|null,reason:string}|null}. Public node does not include author account ID or source share token.
CommunityCommentCommand = {scope,requestId:UUID,parentId:UUID|null,text:string}; result {comment:CommunityComment}.
CommunityLikeCommand = {scope,requestId,commentId}; CommunityGameLikeCommand={scope,requestId}; result {liked:true,count:number}.
CommunityReportCommand={scope,requestId,commentId,reason}; result {reported:true}.
CommunityMe={viewer:CommunityViewer,notices:{id,at,action,reason,until:number|null}[]}.
CommunityReport={id,version,status:'open'|'reviewed',reason,at,reporter:string,comment:{id,body,deleted,version,author,accountId,roomCode},restriction:{version,until,reason}|null}.
CommunityAudit={id,at,operator:string,action,reason,commentId:string|null,accountId:string|null}; list envelopes {items,nextCursor}.
CommunityModerationCommand={requestId,confirmed:true,version:number,action:'dismiss'|'delete'|'warn'|'mute'|'unmute',reason,reportId?:UUID,commentId?:UUID,accountId?:UUID,until?:number|null,targetVersion?:number}. Report target derives from report, direct action target derives from comment/account; version belongs report if present, else comment for delete, else restriction (0 initially). Report actions other than dismiss also require targetVersion for current comment (delete) or restriction (warn/mute/unmute); direct actions reject targetVersion. result {applied:true}.

Endpoints are those in design, responses matching above. List query status/cursor/limit strict; account restriction GET /api/admin/community/users/:id returns {restriction,notices}; own/admin private routes authenticated. All actor IDs server derived. Backend owner may refine types with root coordination before frontend consumption.

## Task1 — Backend community and moderation (worker)

Own packages/contracts/community.ts, packages/storage/community.ts, LobbyStore wrappers, apps/server/app.ts routes, contracts/index.ts errors, tests/community.test.ts and community-wire.test.ts. Do not edit existing frontend/doc files. Start from failing actual LobbyStore tests (missing behavior), then schemas/storage. Existing post/read scope must be reused before every retry; never read drafts to authorize.

- [x] RED read/write permissions, noCookie anonymous, share/favorite revocation, nested/deleted tree, pagination/sorting, irreversible cross-version likes/LA DST, login/mute/report/admin/stale/idempotence, restart/cleanup tests.
- [x] Implement typed persistence, authorization resolver, mutations, audit and own penalty messages; strict query/body/session handling, no public Socket community payload.
- [x] GREEN scoped/wire tests; send precise results and contracts; root reviews before full checks. Do not commit/push/run fullsuite concurrently.

## Task2 — Comment mobile interface (worker, disjoint)

Own apps/web/src/CommunityEntry.tsx/CommentsPanel.tsx/community.css, RecordPostDialog.tsx/SharedRecordPage.tsx/SharedFavoriteDialog.tsx integration, tests/e2e/community.spec.ts. No shared style.css, AdminPanel, AccountDialog or backend changes. Use exact shared contract. TDD E2E existing fixture before UI, all sessions synthetic; only one browser runner at a time coordinated by root.

- [x] RED published/shared page comment entry then login, post/reply/nested folding, sorting/likes/report and lost scope masking.
- [x] Plain text lazy UI with request locks, transient input preservation, original-scope revalidation, no old response resurrection after hide/revoke/version/scope change; existing AccountDialog login callback.
- [x] GREEN UI flows320/390/430, deep reply widths/long text/XSS-as-text and screenshot. Tell root if backend pending; no fullbrowser/server on3000/commit/push.

## Task3 — Admin and own restriction UI (root)

Own CommunityModerationPanel.tsx/moderation.css, CommunityNotices.tsx, AdminPanel.tsx/AccountDialog.tsx integration, tests/e2e/community-moderation.spec.ts, docs.

- [x] RED admin report queue/action confirmation/reason/audit and victim own notice/game still usable.
- [x] Add lazy 评论审核 tab and user comment restriction controls; own penalties and warnings, no appeal, no game account disable for mute.
- [x] GREEN full moderator lifecycle with removed parent preserving replies and private-note isolation.

## Task4 — Review and delivery (root + fresh reviewer)

- [x] Independently review final scoped diff/privacy/concurrency and fix actual failures with regressions.
- [x] Root npm test/typecheck/build/full E2E; inspected mobile screenshot; all required checks before publication.
- [x] Rules/cases/decisions/status/report/matrix stable166IDs and accurate counters, preserve49questions/history; doc/link/diff review.
- [x] Prepare scoped coherent main commits, SHA followup, fetch/non-force push/remote SHA equality; no deployment/real-device claims.

## Ledger / rulings

Ruling: existing current-main delivery workflow and user no-repeated-questions override skill approval/worktree gates; disjoint workers share clean checkout, no new worktree. Cost if wrong: reversible local batch stays reviewable.
Ruling: minimum community moderation plus own account penalty messages included; optional subscription/notification center/deletion/share-admin moderation deferred. Cost: clearly documented partial NOTICE/admin IDs instead of claiming whole platform.
Ruling: comment-only mute blocks comment/reply/commentlikes, not protective reports or game likes/gameplay; this preserves safety reporting and narrow restriction. All policy choices align H-004 and are documented technical defaults.

Review round1 rulings: report-only stale guards are insufficient; also compare actual sanction/comment targetVersion. Public comment avatars return null in v1 so author account UUID is not leaked via existing avatar URL. Warning preserves existing mute expiry/reason (including permanent null), incrementing version while separate notice carries warning reason. Private GETs reject unexpected bodies as well as queries.


2026-10-14 completed verification: root npm test461/461 (18.2s), typecheck/build pass, full Chromium mobile E2E73/73 (5.0m). Independent final review no blockers after2rounds: targetVersion+avatar privacy, perlogicalcommand pending requests and full moderation command retention. Warning preserves permanent restriction/null and reason. Actual lostACK tests RED2duplicates -> GREEN1, mute expiry unchanged. New fixture honors Retry-After/authlimit unchanged. Main504.36KB known500KB warning; comments8.34KB/moderation7.99KB/notices1.65KB lazy. Thirty-second refresh folds pagination/replies, input remains; acknowledged nonblocking. Physical-device/VoiceOver/network acceptance remains pending. Publication/remote check follows prepared docs.

Implementation commit: 5b7d39d249a92840a97d1e4a859505f4130c8dbf. This documentation-only follow-up records the verified code SHA; normal push and final remote equality are checked afterward and reported in the delivery response.
