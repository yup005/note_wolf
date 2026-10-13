# 笔记狼人杀 — 产品决定与对话同步记录

> Updated: 2026-10-12 (America/Los_Angeles)  
> This document records **product-relevant confirmed decisions and current planning**, not the raw ChatGPT conversation.  
> **Source note:** The 2026-10-10 product status below was provided by the project owner as a handoff summary. It is **not** verified against the older GitHub `main` snapshot or by re-running tests.

<a id="owner-decisions-2026-10-12-round2"></a>

## 最新确认：狼王、查验与法官补录（2026-10-12，第二轮28–41项）

来源：Owner逐项回复28A、29A、30A、31A、32B、33A、34B、35B、36A、37B、38A、39B、40“有法官补录”、41A。日期按America/Los_Angeles；环境UTC日期不改写确认日期。本节在涉及同一范围时覆盖第一轮及历史草案；未涉及的既有规则继续有效。本批仅同步需求，不实现、不部署。

| 原问题号 | Owner回答 | 已确认要求 |
|---|---|---|
| 28 | A | 黑狼王因狼刀、放逐、猎人或其他枪杀死亡可发动开枪；毒杀、自爆不可发动。实际发动仍受先判胜与终局停止规则约束。 |
| 29 | A | 白狼王自爆带人沿用普通狼人允许自爆的时段；正式投票阶段与放逐PK台上不得自爆。 |
| 30 | A | 白狼王带走猎人或黑狼王后，被带走者可按自身资格进入死亡技能流程；已经终局时仍停止后续技能。 |
| 31 | A | 最后一狼为黑狼王时，死亡后先按本局规则判胜；若已终局，不再开枪。不是先开枪争取改变已确定胜负。 |
| 32 | B | 最后一狼为白狼王时，自爆后先判胜；若已终局，不再执行带人。此前先带人再统一判胜方案未采用。 |
| 33 | A | 机械狼/装甲狼学习黑狼王，复制第28项确定的黑狼王开枪能力；不降级为只支持狼刀/放逐的现有猎人式触发条件。实际死亡仍按第31项与真实角色判胜，不能用拟态改变真实阵营。 |
| 34 | B | 机械狼/装甲狼学习白狼王，获得白狼王自爆带人能力，覆盖该角色原本不能自爆的限制；不是一次性额外刀。合法时段沿用第29项，死亡链与终局沿用第30/32项。技能具体复制生效时点尚待确认，不能默认由此允许学习当夜自爆。 |
| 35 | B | 黑狼王、白狼王允许分别配置多名，需按每名玩家独立处理能力与多人同角色流程；本项没有授权重复机械狼、装甲狼、女巫等其他原本唯一的特殊角色。 |
| 36 | A | 夜间守护（含普通守护和机械复制守护/无敌盾）在夜间结算完成后失效，不阻挡白天开枪或白狼王带人。夜间已生效的保护仍按原结算，不因进入白天改变已结算结果。 |
| 37 | B | 普通预言家查验已拟态好人身份的机械狼/装甲狼，按拟态身份返回好人；不是直接揭示真实狼阵营。拟态身份如为狼人则按其身份返回狼人；真实混血儿始终返回好人的第13项保持。真实阵营与榜样胜负归属不随查验反馈变化。 |
| 38 | A | 混血儿选择机械狼、装甲狼或狼王为榜样，个人胜负始终跟随该榜样真实狼方阵营，忽略拟态身份。 |
| 39 | B | 手动切回自动可以在任意暂停阶段发起，不限定昼夜边界；需要恢复该阶段的具体进度。阶段/剩余计时/已提交操作和库存核对仍需设计验证，不自动重置或重复执行历史技能。 |
| 40 | 法官补录 | 手动切回自动的缺失事实由法官补录，不采用上一轮建议的各玩家分别补录方案。法官是否独立于参赛房主、谁能担任、其秘密可见/输入权限和确认流程尚未明确，不因此给参赛房主或管理员开放全部秘密。 |
| 41 | A | 已授权临时房主审阅结束申请时可以修正官方死讯，必须保留实际操作者和完整修订记录。 |

### 规则覆盖及未决边界

- 第34项是“学习白狼王”的明确不可自爆例外，不把所有机械/装甲角色一律改成可自爆；未学习白狼王仍按原规则。
- 第35项只放开本轮所问黑/白狼王的重复配置，不推导其他特殊角色重复。
- 第37项改变普通预言家的私密查验反馈，不改变机械/装甲真实身份、真实阵营、胜利判定或混血儿榜样归属。
- 第39/40项批准任意暂停阶段发起切回并由法官补录；法官产品身份/是否参赛及秘密权限必须下一轮明确。不能把“法官”默认为既有参赛房主，也不能通过人工胜负裁定推测未知技能状态。
- 下一轮需确认法官身份和对局形态、复制白狼王的生效时点、白狼王被毒后的警上自爆带人，以及复制技能的跨阶段处理。没有已确认依据的新增分支仍保持未决。

本批基线main为 `14dc0f582420a629a1c79d6d624de62a5be40307`；保留全部旧决定与实现证据。本次不改源代码、测试、数据库或线上配置，未重新执行产品测试；文档确认不代表对应功能已实现。

<a id="owner-decisions-2026-10-12"></a>

## 最新确认：剩余需求第一轮27项（2026-10-12，America/Los_Angeles）

来源：项目Owner逐项回复本轮ChatGPT问卷（1A～27A，含第2/14题文字补充）。本节优先于本文历史摘要、旧未决条目及尚未对齐的索引；仅记录产品决定，不声称代码已实现或上线。保持“暂不部署”；本批不修改代码、线上开关或业务数据。

| 原问题号 | Owner回答 | 已确认要求 |
|---|---|---|
| 1 | A | 分享链接重生成后，旧收藏保留但不可读；读者取得新链接后自行重新收藏，不自动迁移旧授权。 |
| 2 | B＋补充 | 本人可永久删除私人草稿与自己的全部发布版本，并撤销关联分享。已被采纳为官方版本的事实必须独立保留；删除个人版本不删除官方记录，也不影响其他作者记录。 |
| 3 | A | 狼队中间改票等过程不保存，只保存最终有效操作。历史数据如何清理需在实施方案中处理，不在本次直接删除数据。 |
| 4 | B | 房主赛后修正官方事实后，官方事实自动同步到对外展示；个人推理仍须主动发布，不把未发布私人正文自动公开。 |
| 5 | A | 白天提供仅本人可查看的身份与剩余技能入口，不提供历史验人结果重查。 |
| 6 | A | 房主收藏自己的未发布官方记录不需VIP，仍仅本人可见，不能由收藏获得对外分享资格。 |
| 7 | B | 原房主长期失联时，允许已授权临时房主审阅VIP结束申请并裁定。不得凭VIP身份自动取得房主管理权。 |
| 8 | A | 手动局缺少学习、榜样或特殊死亡信息时保留未知，不补造秘密事实；由房主明确人工裁定并公开标注。 |
| 9 | B | 将手动切回自动纳入开发范围；状态补录、校验、时点与失败回退方案尚待设计和确认，不能直接解锁现有按钮。 |
| 10 | B | 暂不开发游客凭据丢失恢复机制；提前绑定账号后使用既有跨设备恢复。 |
| 11 | C | 完全没有任何狼人角色的配置仅允许手动记录，不允许正常自动对局。零普通狼人但仍含机械狼/装甲狼等狼角色的已确认配置不属于本限制。 |
| 12 | A | 仅有狼人、没有任何神职或民职的配置不允许正常开局。无神但有民、无民但有神的既有允许规则不变。 |
| 13 | A | 普通预言家查验真实混血儿始终返回好人，不随榜样阵营改变。通灵师具体身份查验仍显示混血儿。 |
| 14 | 补充明确／未来A | 机械狼板默认使用通灵师，不将普通预言家替换进固定模板。未来特殊板子如含普通预言家，学习普通预言家获得普通好人/狼人阵营查验，按对应技能继承规则下一夜生效。 |
| 15 | B | 机械狼学习已经拟态的装甲狼，复制其当前拟态技能；创建独立完整次数的技能实例，学习时冻结，不随源角色后续变化。 |
| 16 | A | 零普通狼配置中，机械狼首夜已继承狼刀并学习装甲狼获得额外刀，额外刀从下一夜起可用；不影响已继承的普通狼刀。 |
| 17 | A | 现在纳入14人白痴双边独立可选变体的开发；不是按人数自动套用。神边算死、民边仍活、可被刀、翻牌后无发言/投票权沿用已确认规则。 |
| 18 | A | 双边白痴翻牌后被女巫毒杀，彻底死亡，民边也算死。 |
| 19 | A | 双边白痴翻牌后不能再次成为放逐目标。 |
| 20 | A | 现在将黑狼王与白狼王纳入角色目录开发范围；其具体技能、触发时点、死亡链与复制所得能力仍需下一轮确认，不能仅凭名字赋予通用版本规则。 |
| 21 | B | 本轮继续逐个确认实际可发生的复杂反弹、伤害与复制场景，不统一推迟这些规则讨论；未回答的具体场景仍未决，不得自行套默认值。 |
| 22 | B | 学习平民的私密彩蛋在之后每晚本人操作阶段继续显示；不改变真实身份、阵营或能力，不公开显示。 |
| 23 | B | 有效分享链接的外部读者可以看评论，登录后可以发表评论；评论访问不得绕过原链接失效或私人内容权限。 |
| 24 | A | 管理员删除违规父评论后保留子回复，原节点显示已删除。作者不能自行修改/删除评论的原规则不变。 |
| 25 | A | 同局每日点赞限制按统一America/Los_Angeles时区计算自然日，不按设备各自时区。 |
| 26 | B | 复盘更新、回复与点赞通知默认关闭，由用户主动订阅；账户/处罚通知仍保留。30天保留、回复逐条、点赞合并等既有规则不变。 |
| 27 | A | 管理员可撤销他人违规公开分享链接，必须填写原因并留审计；不因此取得私人草稿或进行中秘密的读取权限。 |

### 仍需下一轮具体裁决

- 手动切回自动：允许范围已确认；可切回时点、秘密技能库存的本人补录、公开事实核对与失败回退仍待具体设计。
- 黑狼王/白狼王：角色开发已纳入；可触发死因、自爆时段、带人后的流程、死亡技能链、机械/装甲复制能力尚未确认。
- 复杂组合：按实际可达场景继续问答，不能把“本轮补齐”当成已回答的结算策略；无敌盾对新增伤害、嵌套复制查验、混血儿榜样遇到特殊角色等按具体冲突裁决。
- 个人删除与官方采纳需要独立数据所有权；官方自动同步仅针对官方事实，必须保持私人草稿隔离。新机制需设计与回归验证，不通过直接删除现有数据来假定完成。

### 实现证据边界

读取本批基线main为 `0dbe901f348043b92bd2bd3714ffbd7a0baa611c`。最新交接已记录外部分享读者收藏本地交付（实施SHA `209906e84234d073997d70cd5f79267e25d01b4e`），第1项与其既有重生成规则一致；本次不重复开发。其他选择逐项对照当前代码后安排实施，旧文档中的“未开放/待确认”不能覆盖本节新决定，也不能把本节新决定冒充已有实现。

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

<a id="explicitly-incomplete--planned-according-to-handoff"></a>

## Historical incomplete / planned list from the handoff

- Avatar upload and VIP advanced favorites were incomplete in that handoff; later local deliveries supersede that status (see the decision log and current verification).
- Game likes; comment threads, nested replies and their likes; notification center.
- Reporting/moderation/restrictions and full admin audit features.
- Other boards/roles, guest lost-credential recovery, automatic room cleanup policy and public hosting.
- Payments are not integrated.

<a id="future-feature-requirements-retained-from-earlier-discussions"></a>

## Feature requirements retained from earlier discussions

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
5. VIP favorites management is now implemented locally; next customer-visible candidates are community features subject to moderation prerequisites.

## How to record future ChatGPT decisions

Append a short entry below when the owner confirms a new rule, scope change or product decision. Include date, feature/rule ID if available, **status** (confirmed/proposed/unresolved), changed decision, superseded rule if any, and whether implementation is verified. Never paste private conversation transcripts or secrets into this public repository.

### Decision log

- **2026-10-11 — Owner continuation and explicit GAP-01 decision / ACCOUNT-009:** Continue other confirmed requirements locally, without deployment. The owner chose to retain regenerated old-link favorites as unavailable and require readers to obtain and manually collect the new link separately. This resolves the GAP-01 migration decision; no automatic authorization/name/date transfer is permitted. Logged-in ordinary external readers may collect valid shares; every read and published-body search revalidates the original link, with the participant path independent. Cookie-free anonymous reading, account takeover, private naming, archived metadata and existing room retention boundaries remain enforced. Code/automated verification is recorded separately in [current tests](TEST_REPORT.md); physical-device acceptance and deployment are still pending.

- **2026-10-11 — Owner continuation / ACCOUNT-011–014:** The owner instructed “可以先完成其他需求 暂时不部署”. Implement existing H-003 VIP favorite search/filter/date-sort/private names in the existing game snapshots and participant record collections. This delivery adds readable published-content search, archived board metadata, personal names with optimistic conflict recovery, and active-VIP server checks; ordinary basic access and expired-user saved names remain available. This supersedes those four implementation-pending statuses only. External share-reader collection GAP-01, H-03, community features and physical-device acceptance remain separate. No deployment or Render switch change; executed checks are in [current verification](TEST_REPORT.md).

- **2026-10-11 — BETA-004 implementation under the owner's approval:** The owner accepted the proposed next task in this chat. Existing administrator-only/independent simulated-room requirements are now implemented locally: per-request authorization, real-member join/recovery/Socket isolation, simulated-only identity lists, automatic readiness/confirmation checks and a fail-closed policy for the specifically authorized Render trial. Own-player identity/actions retain their normal private endpoints. This supersedes the earlier not-yet-implemented status, not the confirmed privacy boundaries. Verification is recorded in [current tests](TEST_REPORT.md); no deployment or online flag change in this delivery.

- **2026-10-11 — Later owner confirmation / BETA-004 environment scope:** Permit future administrator-only test tools on the Render trial, exclusively in independent simulated test rooms. This resolves the earlier pending environment decision and creates a narrow exception to production-disabled-by-default guidance. Real-player rooms and other production environments are not authorized. Implement next time, with server/UI authorization and isolation verified before enabling; current runtime remains disabled. No implementation or deployment in this documentation task.

- **2026-10-11 — Owner confirmation / BETA-004:** Future simulated-player test tools must require an administrator account, with both UI entry and server authorization checks. Confirmed requirement, not yet implemented; current development tools still use the environment gate and host authorization. Access remains limited to simulated actors and must never expose real players' secrets. At this confirmation the trial environment decision was pending; the later entry above resolves it. Current production helpers remain disabled until implementation and verification.

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

- **2026-10-11 — Owner continuation / CFG-001 / COPY-001 / WIN-001:** After checking the deployed feature gate, the owner explicitly instructed “先去实现，都弄完了我们再考虑部署”. Continue the remaining confirmed mechanical/armor/custom-board runtime and integration; defer deployment. Fixed private phases, cross-night learning/independent copies, actual knife/protection settlement, mixer/idiot/interjection and extra-night handling are integrated in this delivery. Pure manual absent learning/model/extra-night facts require an explicitly visible host ruling, implementing the existing2026-10-10 manual-adjudication confirmation without granting host secret access. Unknown rule combinations,14-player dual-category policy selection, undeclared special king roles and physical-device acceptance remain separate. This supersedes historical implementation-pending summaries only to the extent evidenced by [current progress](MECHANICAL_IMPLEMENTATION_PROGRESS.md), and does not resolve missing gameplay decisions.
