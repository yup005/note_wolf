# 笔记狼人杀 — 产品决定与对话同步记录

> Updated: 2026-10-10 (America/Los_Angeles)  
> This document records **product-relevant confirmed decisions and current planning**, not the raw ChatGPT conversation.  
> **Source note:** The 2026-10-10 product status below was provided by the project owner as a handoff summary. It is **not** verified against the older GitHub `main` snapshot or by re-running tests.

## Scope and intended experience

- Mobile-first web app for in-person Werewolf games, with priority for iPhone Safari.
- White/light-gray background, minimal rounded cards; seat, phase, and current action should fit on one phone screen when practical.
- Three primary value areas: automatic moderator (自动法官), independent personal notes/postgame review, and persistent account/VIP sharing and collection.
- **Current playable board: 12-player 预女猎白 only** — 4 werewolves, 4 villagers, prophet, witch, hunter, idiot (one each).
- **Out of scope for now: 九尾/白泽 board.** Do not schedule or implement it without a new owner decision.

## Current status claimed in 2026-10-10 handoff (not independently re-tested)

Implemented according to the handoff:
- Four-digit rooms (including leading zero), OTP join, live seats, concurrent seat locking, readiness, room-owner participation, room state recovery.
- Two independent axes: online random dealing or privately entered physical cards; automatic moderator or fully manual recording.
- Automatic nights, role-secret actions and timeouts, wolf vote/knife confirmation, witch medicines, prophet checks, hunter state.
- Full day phases including sheriff candidacy, withdrawals, voting, PK, sheriff transfer/loss, suicide variations, death-chain processing, speeches, ballot collection and win detection.
- Pause/resume with 5-second common countdown, restricted temporary host, carefully bounded reconnection allowances.
- Public Chinese speech prompts without private action disclosure.
- Independent manual drafts, host-authoritative official events and revisions, postgame reviews, publication history, server-side favorites.
- Accounts, login-based device takeover, basic superadmin/VIP administration, VIP-controlled sharing and link revocation.
- Simulation players for development/test rooms only; not for production real-player impersonation.

Handoff's latest reported verification: **156 server tests**, **34 Chromium mobile-viewport browser tests**, TypeScript checks and production build passed **at the time of its report**. This record does not assert that we re-ran them. Physical iPhone Safari, 12 real devices, real voice/audio, lock-screen/weak-network and public Internet deployment **remain unaccepted/unverified**.

**Version provenance:** at the start of initialization, GitHub `main` (`fc21863`) still contained the earlier lobby code and reports (10 server tests / 4 browser tests), plus the two collaboration documents. The later local snapshot was saved as `a6332eeea7ce4fbcb92b4f87e0b370b6fc3fb915` on `codex/preparation-dealing`. Initialization freshly ran 156 server tests and 34 Chromium mobile-viewport tests (zero failures/skips), typecheck and production build successfully. This verifies automated behavior on that snapshot; it does not certify every historical rule case or physical-device acceptance. On 2026-10-10, the owner authorized merging [PR #1](https://github.com/yup005/note_wolf/pull/1); `main` now contains the snapshot and workflow through merge commit `ac186c1c92e8cdbd45dc1d7bcc3762013745342c`, along with newer product-discussion documents. Compare actual refs before assuming another branch contains it.

## Current rules and boundaries to preserve

- First day: sheriff election before first-night public death announcement.
- Wolf phase max 180 seconds. Witch max 60 seconds first night, then 30 seconds, prophet and hunter max 30 seconds, **5 seconds between closed-eye phases per newer handoff**. The 2026-10-09 older rule draft says 10 seconds — flag the mismatch for code/spec reconciliation, do not silently revert.
- Sheriff vote, PK, day exile, 1.5x sheriff exile vote, physical vote entry by host and private phone votes are distinct paths.
- Ordinary wolf suicide pointing, pre-announcement poisoned-wolf suicide, and second suicide swallowing sheriff badge have special confirmed branches; protect timing and privacy.
- A final game outcome immediately ends the game, with board-specific simultaneous win-priority rules.
- Auto → manual recording is available; **manual → auto is not released** and requires a separate rule decision.
- Official host record and each valid VIP participant's personal draft are distinct and private; unrecorded manual actions must never be fabricated.
- Published versions update only by author action. VIP external link access depends on active membership; expiration temporarily disables unrevoked links and renewal restores them.
- Guests may play; administrators/temporary hosts cannot read ongoing secret identities/actions or unpublished private notes.

## Explicitly incomplete / planned according to handoff

- Avatar upload; VIP advanced favorites search/filter/sort/custom names.
- Game likes; comment threads, nested replies and their likes; notification center.
- Reporting/moderation/restrictions and full admin audit features.
- Other boards/roles, guest lost-credential recovery, automatic room cleanup policy and public hosting.
- Payments are not integrated.

## Future feature requirements retained from earlier discussions

- **Game likes:** one per logged-in account per game per calendar day, non-reversible, across all review versions.
- **Comment/reply likes:** one per account per comment/reply lifetime, non-reversible.
- **Comments:** multi-level replies; newest/hottest/oldest sorting; author cannot edit or delete after posting, moderation and audit required for admin removal.
- **Notifications:** new published review version, replies, aggregated comment likes and admin messages; read/read-all/delete/clear; 30-day notification record cleanup without deleting source content.
- **Moderation:** one report/account/content item, admin review, warnings, timed/permanent comment restriction; restrictions do not prevent gameplay.
- **VIP advanced favorites:** search, board filtering, date sorting and user-defined names. Ordinary accounts retain basic accessible favorites; expired/revoked links do not become accessible through favorites.

These remain **planned** unless current code/tests show otherwise; do not reimplement completed portions based only on old drafts.

## Decisions that remain open (do not turn into code defaults)

1. Whether/how manual recording may return to automatic moderation and what official state must be reconciled.
2. Long-term missing host handling for VIP end requests.
3. Minimum death-cause/skill provenance for manual recording and future board-specific rules.
4. Access/VIP semantics of an owner's unpublished official-draft favorite.
5. Definition of effective activity, room expiration and status of unfinished unpaused games.
6. Older 10-second night interval versus newer 5-second handoff: **newer handoff is current planning baseline**, verify code and tests before changing either.
7. Other legacy rule edge cases still tagged unresolved in `docs/WEREWOLF_RULES_SPEC.md` and `OPEN_QUESTIONS.md`; verify whether later implementation/decisions actually resolved them.

## Proposed next priorities (recommendations, not approved scope)

1. Compare latest local branch to GitHub and reconcile documentation without losing newer work.
2. Test on physical iPhone Safari and multi-phone full games; verify real speech, backgrounding, interruption and weak networks.
3. Private HTTPS beta hosting, persistence, backups, logging, and security boundaries.
4. Fix any acceptance blockers and refine mobile one-screen usability.
5. Next customer-visible additions: VIP favorites management, then community features subject to moderation prerequisites.

## How to record future ChatGPT decisions

Append a short entry below when the owner confirms a new rule, scope change or product decision. Include date, feature/rule ID if available, **status** (confirmed/proposed/unresolved), changed decision, superseded rule if any, and whether implementation is verified. Never paste private conversation transcripts or secrets into this public repository.

### Decision log

- **2026-10-11 — Owner confirmation / BETA-004:** Future simulated-player test tools must require an administrator account, with both UI entry and server authorization checks. Confirmed requirement, not yet implemented; current development tools still use the environment gate and host authorization. Access remains limited to simulated actors and must never expose real players' secrets. Production helpers remain disabled; opening isolated test rooms on the Render trial requires an explicit environment-scope decision, still pending.

- **2026-10-11 — Owner authorization / ADMIN-001 / BETA-009:** Initialize the online trial administrator using existing unique-admin startup behavior and Render secret environment configuration. Login and protected administrator endpoint passed; no credentials or player database published. [Deployment evidence](RENDER_TRIAL.md#最新管理员初始化2026-10-11).

- **2026-10-10 — Confirmed / BETA-009 trial hosting:** Owner chose Render Free trial and confirmed My Workspace. Deploy the existing single-service app rather than implementing Sites now. Render returned live for source `fab5566d84ec2fb2b3572d105f3e1935a879911a`; HTTPS/WSS and synthetic preparation/access checks passed. Temporary SQLite may be lost on sleep/restart/redeploy; persistent storage, backups and real-device full-game acceptance remain incomplete. No paid upgrade or live-database migration is authorized. Configuration and evidence: [Render trial](RENDER_TRIAL.md).

- **2026-10-10 — Confirmed:** Exclude 九尾/白泽 board from current plan.
- **2026-10-10 — Confirmed:** Keep a structured, versioned product requirement matrix; distinguish implemented, proposed, unverified and unresolved.
- **2026-10-10 — Workflow preference:** After each completed Codex task, run applicable verification, commit scoped changes and push automatically where permissions permit. The later delivery-batch clarification below defines completion; this does not require publication after every message or intermediate edit.
- **2026-10-10 — Workflow preference:** Document future confirmed ChatGPT product decisions here via the connected GitHub workflow; it is an action taken during conversation, **not** continuous background syncing.
- **2026-10-10 — Workflow initialization (no new gameplay decision):** Safely integrated the two remote docs, preserved the latest local project snapshot, expanded `AGENTS.md` with requirement preflight, automatic tested commit/push, progress/SHA records and remote verification. Full evidence and remaining gaps are in `PROJECT_STATUS_FOR_CHATGPT.md` and the current section of `TEST_REPORT.md`; no unresolved rule or matrix item was promoted to implemented by this task.

- **2026-10-10 — Confirmed / Mechanical wolf seer:** New board under requirements discussion. Use 京城大师赛 as rules baseline; from night 2 onward mechanical wolf always acts after witch regardless of learned role; learning may be deferred; unlearned mechanical wolf checks as 「机械狼」 and learned one checks as copied role. Details, open questions, and Codex implementation hold are tracked in [`docs/MECHANICAL_WOLF_SEER.md`](MECHANICAL_WOLF_SEER.md). **Not implemented or validated.**
- **2026-10-10 — Later confirmed clarification / Mechanical wolf seer:** The later remote document commits `814612d` / `87eadb6` clarify that mechanical wolf acts after witch **from the first night**, superseding the preceding entry's second-night start, and may learn only another living player. Remaining rules and implementation hold are unchanged; preserve the latest discussion document without implementing it in this workflow task.
- **2026-10-10 — Authorized integration:** Owner approved merging PR #1. The existing local snapshot and persistent workflow are now on `main` at `ac186c1c92e8cdbd45dc1d7bcc3762013745342c`; this integration adds no gameplay feature or device-acceptance claim.
- **2026-10-10 — Confirmed workflow clarification (no gameplay change):** Publish automatically by completed feature, verified bug fix (or related fixes delivered together), or coherent documentation/requirements batch. Save intermediate edits locally, optionally with scoped checkpoint commits; multi-round discussion changes accumulate until the phase/batch is complete or GitHub/ChatGPT sharing is needed. An explicit push/share request establishes a boundary; save-only/hold instructions take precedence. This clarifies the earlier automatic-publication preference: no push per message or small edit, and no repeated reminder at delivery. Required checks, scoped diffs, progress records, safe non-force push, remote verification and separate PR-merge authorization remain mandatory. Detailed procedure lives in [CODEX_WORKFLOW.md](CODEX_WORKFLOW.md#standing-git-workflow-preference-authorized-by-project-owner).

- **2026-10-10 — Owner authorized implementation / first delivery:** In this Codex chat the owner explicitly requested starting the GitHub-updated new-board requirements. Begin CFG-001 / COPY-001 / WIN-001 shared domain foundations; existing playable room/API/UI remains the standard board until full flow and unresolved rules are ready. This supersedes earlier implementation holds only for confirmed work, not permission to invent missing rules. The owner also confirmed mechanical-armor bonus knife unlocks only after its actor inherits the ordinary knife and may share or differ from the ordinary knife target in the same night. The prior unresolved bonus-unlock item in `MECHANICAL_ARMOR.md` is superseded; remaining edges stay unresolved. Implementation status is in [current progress](PROJECT_STATUS_FOR_CHATGPT.md).

- **2026-10-10 — Confirmed scope expansion:** Mechanical wolf board is no longer fixed to 12 players; configurable counts/roles include a 13-player mixer example and 15-player villager/wolf/idiot additions. Presence of an armored wolf automatically selects the separate mechanical-armor ruleset. The armor wolf copies an already-mimicked mechanical wolf's copied ability; a mechanical idiot has a special last-wolf extra-night knife. Requirements and outstanding rule interactions: [`docs/MECHANICAL_WOLF_SEER.md`](MECHANICAL_WOLF_SEER.md) and [`docs/MECHANICAL_ARMOR.md`](MECHANICAL_ARMOR.md). **Requirements discussion only; not implemented.**

- **2026-10-10 — Confirmed configurable product architecture and six armor rule decisions:** Keep fixed board presets *and* allow custom player/role composition; use one reusable skill-copy engine rather than hardcoded role-pair interactions; apply special victory rules across the entire game. For armor ruleset, bonus dual knife is one-time; copied mimicked skills get independent full charges and freeze at copy time; invincible mechanical guard blocks all wolf attacks and poisons; mixer chooses model on first night; last-wolf mechanical idiot's bonus night runs other surviving roles' normal actions. Full scope and unresolved edges: [`docs/MECHANICAL_ARMOR.md`](MECHANICAL_ARMOR.md). **Not yet implemented.**

- **2026-10-10 — Confirmed / board presets and custom composition:** Mechanical armor preset has 12 players: seer, witch, hunter, guard (one each), four villagers, two regular wolves, one mechanical wolf, one armored wolf. Duplicate *special* roles are out of scope; regular wolf/villager multiplicity is allowed. Custom boards may have zero regular wolves. Built-in templates are immutable but can populate an editable custom board, and custom boards can be saved. Host may manually adjudicate rule conflicts with explicit visibility and no silent automatic resolution. See [mechanical armor](MECHANICAL_ARMOR.md) and [mechanical wolf requirements](MECHANICAL_WOLF_SEER.md). Not implemented.

- **2026-10-10 — Confirmed / zero-wolfpack compositions and victory categories:** Wolfpack membership is defined by joining the ordinary-wolf shared night knife (e.g. Black Wolf King / White Wolf King when configured to wake with ordinary wolves), not literal role title. With zero such wolves, a mechanical wolf inherits the knife on night one; if an armored wolf also exists it must wait until the mechanical wolf is out. Mixer follows role-model camp's victory without changing its original role. Custom boards with no gods or no villagers are allowed and empty victory-target sets never trigger automatic game-over at start. See [rules](MECHANICAL_WOLF_SEER.md) and [armor](MECHANICAL_ARMOR.md). Not implemented.

- **2026-10-10 — Implementation planning (not delivered):** Consolidated confirmed mechanical-wolf, armor, custom-board, skill-copy, victory and idiot/mixer rules into [Codex implementation plan and acceptance matrix](CODEX_MECHANICAL_BOARDS_IMPLEMENTATION.md). M0–M6 milestones, regression/security cases and blocked unresolved edge rules are explicitly separated. No gameplay implementation or test verification is claimed.

- **2026-10-10 — Owner-authorized staged execution / implementation status:** Owner requested M0–M2 first against the unified M0–M6 plan and authorized automatic continuation after each verified milestone commit/push. M0 baseline is verified/published. M1 adds selectable immutable templates, private saved custom compositions, public room snapshots and dynamic lobby seats; full new-board gameplay remains gated until later milestones. No unresolved gameplay decision is settled by this configuration delivery. Evidence is maintained in [milestone progress](MECHANICAL_IMPLEMENTATION_PROGRESS.md).

- **2026-10-10 — Mechanical armor inheritance reconciliation (M2):** Confirmed source commits [ced569a109bf0a337c540064831a1bbc4295b4a7](https://github.com/yup005/note_wolf/commit/ced569a109bf0a337c540064831a1bbc4295b4a7) and [fab5566d84ec2fb2b3572d105f3e1935a879911a](https://github.com/yup005/note_wolf/commit/fab5566d84ec2fb2b3572d105f3e1935a879911a) explicitly require base confirmed rules unless an armor override exists. This resolves MA-VICTORY-SIMULTANEOUS to wolves priority, copied-skill default timing, guard self/pass/no consecutive target and wolf information separation/no suicide/inherited knife self/pass. The owner also confirmed this turn stops at M0–M2. M3–M6 and genuine unresolved interactions remain pending; engine framework does not grant full new-board gameplay.


- **2026-10-10 — Later owner confirmation / M3–M5:** New-board witch never self-saves, including after night1; ordinary/mechanical-reflect guard and armor invincible shield together with antidote cause 奶穿 for the ordinary wolf knife. Prior first-night-only wording is superseded. Other attack sources remain separate; undefined reflection chains are not resolved by this confirmation.
- **2026-10-10 — Later owner confirmation / Mixed blood:** Display name 混血儿 (internal mixer unchanged). First-night selection is private to that player, cannot select self; timeout randomly assigns a legal model and that player may inspect their own assigned model during daytime. Exact-role inspection and mechanical learning feedback show 混血儿, copied role gains no extra skill. Camp-only seer result remains unconfirmed. Owner additionally authorizes a12-player 预女猎白 variant replacing one of four villagers with mixed blood:3 villagers+1 mixed blood count as four civilian targets and all must die; the expanded13-player leave-one-villager condition does not apply to this variant. Configuration/runtime variant is still pending.
- **2026-10-10 — Later owner confirmation / Idiot:** Flipped ordinary idiot is dead for god elimination. In the14-player dual-category variant it remains a living civilian target, can still be knifed and is announced dead next day after a knife, but cannot speak/vote. Only that dual-category variant loses speaking; other ordinary/mechanical idiots retain previously confirmed independent15-second interjection rights. Nonfinal-wolf mechanical idiot dies on flip. Final-wolf exile retains confirmed extra-night branch; if wolves already satisfy elimination, wolves win immediately and no later voting occurs. Separate extra-night state machine remains pending.
- **2026-10-10 — Owner authorization / Account profile:** Implement logged-in nickname/avatar editing. Upload limits supersede old defaults: ordinary1MB, activeVIP2MB (implementation byte limit1024×1024); JPEG/PNG/WebP preview, replace/delete through own-account routes. No live secret access is granted. Existing local admin account remains active; do not create a second superadmin or publish credentials.
- **2026-10-10 — Owner confirmation / FUTURE-001:** Rooms without any user's favorites or a non-revoked share are automatically cleaned24h after last successful user activity, INCLUDING ongoing and paused games. This supersedes the old indefinite paused-game retention proposal. Successful user business changes renew activity; passive reads/socket heartbeat/automatic timers do not. Both favorite systems protect rooms. Temporarily paused/VIP-expired/withdrawn/disabled but non-revoked shares retain protection because links can resume; actively revoked links alone do not protect. Legacy databases receive a migration activity baseline rather than immediate deletion from stale creation timestamps. This retention implementation is in progress; do not claim deployed or tested before evidence.

- **2026-10-11 — Owner confirmation / G-003 / FUTURE-001 / RECAP-008:** 24h cleanup deletes runtime room state only. Independent replay archives, private drafts/notes, published versions and manual revisions retain their existing authorization and remain stored. No archive deletion is authorized by the room-retention requirement.
