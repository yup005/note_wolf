# Project progress

## 当前：夜间核心规则验收复核（2026-10-18复核，2026-10-19交付）

NIGHT-006/007/009/010/012/017对照既有代码/规则补充特征验收，没有修改产品逻辑或新增玩法。5项由需核改为已实现；30秒提醒逻辑已核实，实际手机声音仍待真实验收。新增3项真实存储/presence/同夜死讯回归通过；完整564项、类型/构建及3项浏览器专项通过，独立复核无具体问题。完整范围见[规格](WEREWOLF_RULES_SPEC.md#night-core-acceptance-2026-10-18)，执行与SHA见[报告](TEST_REPORT.md)/[交接](PROJECT_STATUS_FOR_CHATGPT.md)。166项ID/49确认保留，N-02在线个人超时未被裁决，不部署或声称真机通过。

## 历史：紧凑收藏、记录入口与房主私密收藏（2026-10-18）

FUTURE-005 / H-003 / Owner6A补齐赛后“仅自己收藏”、首页本人只读入口及发布转换，不增加分享/评论或私人正文搜索。完整条件见[规则](WEREWOLF_RULES_SPEC.md#private-official-favorite-2026-10-18)，实际验证及实施SHA见[交接](PROJECT_STATUS_FOR_CHATGPT.md)/[报告](TEST_REPORT.md)。166项ID/49确认保留，不部署，实机另验。

本批收到Owner新反馈后追加[收藏与记录入口调整](WEREWOLF_RULES_SPEC.md#record-entry-compact-favorites-2026-10-18)：默认3条、收起筛选，首页“我的记录”前置并直达可写对局编辑器，笔记/保存置前；延迟进入在退出/首页时取消。没有增加归档写权限。最终完整561项自动测试、类型/构建及109项Chromium回归通过；中断/睡眠超时历史及5项专项修正、独立复核见报告。

## 历史：官方纠错同步（2026-10-18）

H-002 / RECAP-005/007 / Owner4B：已提交官方事实/修订与冻结发布正文分开展示，入口/隐私/原链接及归档边界见[规则](WEREWOLF_RULES_SPEC.md#official-sync-2026-10-18)。实际验证及实施SHA见[交接](PROJECT_STATUS_FOR_CHATGPT.md)/[报告](TEST_REPORT.md)。完整555项/类型/构建、全量102项Chromium通过；最后后端修订编号修复的新服务专项另记于报告，不混加用例数。166项ID及49项确认保留，不部署，真实设备独立。

## 历史：最终有效事实复盘（2026-10-17）

RECAP-001/006 / H-002 / GAP-04：新投票输入事件最小化、赛后/新自动收藏/旧收藏读取搜索最终事实投影接入；完整边界见[规则](WEREWOLF_RULES_SPEC.md#final-replay-2026-10-17)。旧原件、个人版本和纠错/审计保留，无迁移删除或物理擦除。新增8项专项、完整551项/类型/构建及完整对局专项通过，独立审查无重要发现；最终整套101项浏览器通过；实施SHA见[交接](PROJECT_STATUS_FOR_CHATGPT.md)/[报告](TEST_REPORT.md)。166项ID/49确认保留，不部署，实机独立。

## 历史：白天本人身份与技能（2026-10-17）

S-001 / GAP-05 / Owner5：默认收起的本人身份/真实技能余量接入；完整条件见[规则](WEREWOLF_RULES_SPEC.md#day-self-2026-10-17)。领域/HTTP新增8项，完整543项、类型/构建和2项界面专项通过；独立审查无重要发现。全量101项Chromium回归通过；实施SHA见[交接](PROJECT_STATUS_FOR_CHATGPT.md)/[报告](TEST_REPORT.md)，166项稳定ID与49项原确认保留；不部署，真实设备验收仍独立。

## 历史：公开管理记录（2026-10-17）

GAP-03 / S-003 / S-004五类公开控制变更的持久审计、当前管理者读取、前后变化/分页和赛后记录编辑页入口已本地接入；完整范围见[规则](WEREWOLF_RULES_SPEC.md#management-history-2026-10-17)。审查发现的跨夜警徽缺失已补失败回归并修复，完整535项/类型/构建、整套99项浏览器及修复后新服务2项专项通过；实施SHA统一见[交接](PROJECT_STATUS_FOR_CHATGPT.md)及[报告](TEST_REPORT.md)。166项稳定ID及49项确认保留，更广配置和实机验收仍独立，不部署。

## 历史：语音默认、评论弹窗与基础诊断（2026-10-16开始，2026-10-17交付）

默认夜间预录播报、设备关闭记忆、只说“请闭眼”和记录弹窗整体滚动修复已接入；BETA-011基础脱敏关联/核心读取健康检查/后台异常与恢复接入，运维配置仍部分实现。最终528项自动测试、typecheck/build及完整97项Chromium通过；首次中断/失败及25项复测、独立审查修复与实际执行时长见[报告](TEST_REPORT.md)，当前范围/实施SHA见[交接](PROJECT_STATUS_FOR_CHATGPT.md)。不部署，实际iPhone声音/后台/弱网/多手机仍待验收。166项ID及49历史确认保留，文档相关引用/职责/完整性复查同批完成。

## 历史：本地备份与隔离恢复（2026-10-15开始）

BETA-010/GAP-06本地一致性快照、SHA-256核验和仅新文件恢复接入；工具权限与完整说明见[操作文档](DATABASE_BACKUP.md)，实际验证和SHA见[交接](PROJECT_STATUS_FOR_CHATGPT.md)及[报告](TEST_REPORT.md)。最终专项14项、完整518项（0 fail /0 skip，29.7s）及typecheck/build通过；独立审查指出的结构校验缺口已补4项失败回归并在单轮修复中关闭，命令示例同步。文档13份/415引用、166稳定ID/汇总及49历史确认检查通过，无需删除有用来源；生产持久存储/异机/周期保留/恢复目标仍待配置，BETA-010部分实现。不部署、不读取真实库、不改游戏/UI权限。

## 历史：后台监督管理（2026-10-15交付，2026-10-14开始）

ADMIN-005–007 / Owner27：举报人数汇总、筛选/安全CSV、实际VIP/状态/社区/分享撤销审计及原因确认撤销原链接，边界见[规则](WEREWOLF_RULES_SPEC.md#admin-oversight-2026-10-14)。数据层专项58项、最终完整504项、typecheck/build及管理/审核专项12项通过；三处P2与失败响应焦点补回归修复后独立复查通过，最终全量96项Chromium通过（0 fail /0 skip，7.9m）；原测试准备的真实限流/异步清理/阶段等待已修正并独立复查，原断言与生产限制保留。文档12份/389本地引用、166稳定ID/汇总及49历史原文检查通过，无需删除有用来源。最终证据/SHA以[交接](PROJECT_STATUS_FOR_CHATGPT.md)及[报告](TEST_REPORT.md)为准；不部署/不宣称实机验收，保留稳定ID与历史。

## 历史：通知中心（2026-10-14）

NOTICE-001–005 / H-004：账号顶部通知/三项默认关闭的订阅、必收账号/处罚消息、已读/删除/清空及实际30天清理接入，收藏更新标记独立、原来源权限/旧事件去重保留。完整条件见[规则](WEREWOLF_RULES_SPEC.md#notifications-2026-10-14)，最终检查/独立审查及实施SHA见[交接](PROJECT_STATUS_FOR_CHATGPT.md)与[报告](TEST_REPORT.md)。最终494项自动测试、typecheck/build、全量87项Chromium和独立审查通过；手机视口/触控/键盘及原请求重试、分页/跨账号保护有回归，文档/166项ID与49项原确认检查通过。完整后台/持久存储/真实设备仍保留，未部署。

## 历史：个人记录永久删除（2026-10-14）

ADMIN-008/H-004：本人二次确认删除草稿/全部本人发布版本及分享；官方事实、他人记录/评论和独立收藏元数据保留。归档/VIP到期可删，明确新建/旧授权隔离，双向绑定冲突及会话切换保护已补齐。完整规则见[现行规格](WEREWOLF_RULES_SPEC.md#personal-record-deletion-2026-10-14)，执行证据/审查及实施SHA见[交接](PROJECT_STATUS_FOR_CHATGPT.md)与[报告](TEST_REPORT.md)。通知/持久存储/真实设备等仍待完成，未部署。

## 历史：评论与基本审核（2026-10-14）

SOCIAL-001–008的已发布复盘评论/回复/点赞和基本举报/审核/禁评接入；NOTICE-003及ADMIN-005/007只完成社区部分。规则统一见[当前规格](WEREWOLF_RULES_SPEC.md#community-2026-10-14)，执行和实施SHA见[交接](PROJECT_STATUS_FOR_CHATGPT.md)与[报告](TEST_REPORT.md)。完整通知/后台、记录删除及实机仍待完成，不部署。下方旧“最新/当前”是相应日期历史。

## 当前：临时法官与补录切回（2026-10-13）

FUTURE-002 / MANUAL-002 / COPY-001 / S-001：显式死亡法官、秘密补录与核对恢复、普通预言家拟态阵营反馈已接入。当前条件统一见[规则](WEREWOLF_RULES_SPEC.md#judge-and-automatic-return-2026-10-13)，实际检查/审查修复与实施SHA统一见[最新交接](PROJECT_STATUS_FOR_CHATGPT.md)及[报告](TEST_REPORT.md)。下方原“最新/当前”保留为相应日期历史，旧单向切换/待开发/日间语音不覆盖后续已确认实施。未定义交互及真实设备验收保留，不部署。

## 最新：双边白痴与配牌边界（2026-10-12）

FUTURE-007 / CFG-001 / WIN-001：14人真实白痴的独立双边选项、神/民结算、跨夜/转手动/归档已本地接入；无狼仅手动并由房主确认结束、不判胜可发布，纯狼不能正常开局。标准12及机械白痴额外夜保留。最新确认、实际检查结果、审查修复、实施SHA与未部署/实机边界统一见[当前交接](PROJECT_STATUS_FOR_CHATGPT.md)和[验证报告](TEST_REPORT.md)；下方旧日期章节保留为历史证据，不能覆盖本批已实施项。


## 最新：插话公共播报修复（2026-10-11）

AUDIO-003 / WIN-001维护：白痴插话已暂停原发言者，但公共语音仍叫原发言者继续发言。新增真实日间指令→公开投影→语音回归先复现失败，再按公开插话座位播报；结束插话恢复原发言提示，暂停／恢复／重连仍优先。提示不读取或说明真实身份、学习、刀权或额外夜。

本批最终 `npm test` **321 pass /0 fail /0 skip**、typecheck/build通过；适用语音Chromium手机视口E2E **8 pass /0 fail /0 skip**（11.9s），未改UI组件，未重复全量44项浏览器测试。21项语音／插话／控制针对性测试通过；构建仅原有Zod注释提示。真实iPhone声音仍未验收，未部署。缺失规则与14人策略边界不变。实施提交：[341a79e90a25727f9dca9a0bc01deed6a9e61707](https://github.com/yup005/note_wolf/commit/341a79e90a25727f9dca9a0bc01deed6a9e61707)。本次SHA跟进仅文档，引用／差异检查通过，未重跑代码测试；正常推送后核对远端SHA。

## Current: confirmed mechanical/armor and custom runtime (2026-10-11)

CFG-001/COPY-001/WIN-001: dynamic dealing in all four online/physical × automatic/manual combinations; fixed private stages, independent learning/copies and settlement, inherited knives, mixer model, default idiot/interjection and actual last-wolf bonus-night flow. Host adjudication for missing private manual facts is explicit and retained in public results, revision history, immutable published versions and sharing; hosts gain no private reads. Standard12 and its authorized3-villager+1-mixer variant remain covered.

Fresh verification: unit320/320, typecheck/build pass; full Chromium mobile E2E 44 pass /0 fail /0 skip（1.6m）. Review defects have failing/passing regressions. All data synthetic; real iPhone/voice/background/weak-network/multiplayer acceptance pending. Unknown rule interactions remain blocked,14-player dual-category policy unselectable and special king runtime roles absent. Documentation reviewed for consistent current scope, stable IDs/source history and evidence boundaries. No deployment; Render auto-deploy verified off. Implementation SHA follows in this batch. See [current test evidence](TEST_REPORT.md) and [milestone limits](MECHANICAL_IMPLEMENTATION_PROGRESS.md).

实施提交：[dc8de15a4ffb707e540d329315736eb6def44bf2](https://github.com/yup005/note_wolf/commit/dc8de15a4ffb707e540d329315736eb6def44bf2)。本次SHA跟进仅文档，复核引用与差异，代码检查未重复运行；正常推送后另核对最终远程SHA。

## Historical: profile, runtime retention and internal mechanical domain (2026-10-11)

ACCOUNT-001/010: own nickname/avatar editing, ordinary1MiB/activeVIP2MiB, JPEG/PNG/WebP normalization and preview/replace/delete, retained room/session/private identity. G-003/FUTURE-001/RECAP-008: startup/minute cleanup after24h successful-user inactivity including playing/paused; either favorites or unrevoked renewable shares protect rooms. Runtime-only deletion preserves independent drafts/history/authorization and completed unpublished-record publication after restart. Offline resubscription distinguishes deleted rooms from existing nonmembership. Both review defects reproduced before fixes; independent follow-up confirmed resolution.

COPY-001/WIN-001: 44 internal M3/M4 domain tests for concrete profiles/copy/inspection/settlement; runtime phases/private player UI, M5 and M6 remain pending and new-board dealing gated. Final full unit271/271, typecheck/build pass, full Chromium E2E42/42; synthetic phone screenshot reviewed. Physical iPhone Safari/actual sound/multiplayer/weak network unverified. Reviewed documentation consistency, retained stable IDs and confirmation history, superseded old avatar quotas/paused-room exemption and marked resolved early questions historical. Implementation SHAs recorded in batch follow-up; no PR merge or Render redeploy.

资料/清理实现：[完整提交 7387f6fa7aed0bda4d8a860466ae490a8be4d7e9](https://github.com/yup005/note_wolf/commit/7387f6fa7aed0bda4d8a860466ae490a8be4d7e9)；机械内部增量：[完整提交 5a95561bce2db24f5da46db51faf3c4d8ee7309e](https://github.com/yup005/note_wolf/commit/5a95561bce2db24f5da46db51faf3c4d8ee7309e)。本SHA跟进仅文档，检查112个本地链接/锚点及差异，未重复运行代码测试；发布后另核对远程SHA。

## Current: duplicate favorites repair (2026-10-10)

RECAP-006 maintenance: FavoritesPanel and MySharesPanel used the same sibling React key. Separate key prefixes prevent orphan favorites panels after account transitions. Regression reproduced before the fix and passed after it. Verified the exact delivery source in an isolated copy: npm test196/196, typecheck/build pass, full Chromium E2E37/37 (including three login/logout cycles). Other profile/retention/mechanical edits remain local and are excluded from this delivery. Physical iPhone Safari remains unverified. See [test evidence](TEST_REPORT.md).

## Current: local development and seat text repair (2026-10-10)

Fixed stale backend/frontend contract mismatch, source watch paths and graceful Vite/HMR shutdown before HTTP shutdown. Local test console remains available through dev:test; production remains disabled. Seat names/tags no longer shrink vertically. Full unit226 (including30 pending separate mechanical-domain checks), typecheck/build and full browser36 passed; targeted5 passed. Localhost/LAN HTTP200 verified from this computer; physical phone/LAN acceptance pending. See [test evidence](TEST_REPORT.md). Original local database and sessions retained.

## Historical: 2026-10-10 authorized integration

Owner authorized merging [PR #1](https://github.com/yup005/note_wolf/pull/1). GitHub confirms it is merged at `ac186c1c92e8cdbd45dc1d7bcc3762013745342c`; local `main` was fast-forwarded and the remote SHA checked. The feature branch remains available. Incoming mechanical-wolf discussion updates were retained, with no game implementation. Code/tests/build configuration match the previously verified snapshot; this integration did not rerun code tests. Progress/provenance changes receive document/link/diff checks and normal commit/push. Physical-device acceptance remains outstanding.

## Historical: 2026-10-10 workflow initialization

Branch: `codex/preparation-dealing`. Safely integrated remote collaboration documents from `fc21863` while preserving local development. Saved the pre-existing code/docs in [`a6332eeea7ce4fbcb92b4f87e0b370b6fc3fb915`](https://github.com/yup005/note_wolf/commit/a6332eeea7ce4fbcb92b4f87e0b370b6fc3fb915). This task added no game feature or new rule; it only configured the standing workflow and maintained documentation, with two empty-line whitespace cleanups.

Fresh verification: 156 server tests and 34 Chromium mobile-viewport tests passed (zero failures/skips), typecheck and production build passed. Physical iPhone Safari, real voice/multiplayer, background/lock-screen, weak networks and public deployment remain unverified. Full current status, requirement references and remaining issues: [PROJECT_STATUS_FOR_CHATGPT.md](PROJECT_STATUS_FOR_CHATGPT.md). Future completed tasks update that record; the following ledger is historical.

## Historical lobby ledger — docs/superpowers/plans/2026-10-09-werewolf-lobby.md

User authorized native continuous execution. Current branch `work` in managed task workspace; no main/master edits or external publication.
Pre-flight: Store methods feed HTTP and socket public projections; UI consumes same contracts. No conflicting interfaces.
Ruling: use current managed work branch, not a nested checkout, to keep deliverable in the user's workspace. Cost: changes reside in current work branch.
Ruling: persist ledger in docs because skill helper files are cloud resources, not installed executable files. Cost: manual phase tracking.

Task 1: complete — dependency installation, SQLite foundation test and typecheck passed. Sandbox disallowed local IPC; scripts use node --import tsx and network-granted test calls.
Task 2: complete — six real SQLite tests passed (including 10,000-code exhaustion and persistence). Initial RED: missing storage implementation.
Task 3: complete — two real HTTP/socket tests passed; full suite 9/9. Initial RED: missing server module. Typecheck exposed UUID inferred type; requestId is explicitly string to match validation contract.
Task 4: implementation built successfully. Browser RED: no index/UI; first functional run exposed decorative plus in create button accessible name. Fixed aria-label without changing visible copy.
Task 4: complete — three Chromium end-to-end cases passed: 3 independent UI contexts realtime synchronization, OTP deletion/paste and warning-once, 12 independent API contexts full capacity. Refresh and offline/reconnect included.
Final review: independent reviewer review_lobby found one important issue: lost create response + reload forgets pending request key. Reproduced against real Chromium, fixed by persisting key and original payload, retaining on error and clearing only on confirmed success. Regression passed.
Final review: corrected copy button to ≥44px per design; clarified L-03 temporary name input validation is not a confirmed product rule; expanded real service restart test to verify session cookie + websocket membership.
Final: minor (deferred): plain HTTP LAN clipboard API may be unavailable; room number remains visible and manually copyable.
Final: minor (deferred): no browser injection test for deliberately delayed older websocket snapshot; revision guard is implemented, service and browser state convergence verified.
Task 5: complete — final suite 10/10, typecheck, production build, browser E2E 4/4 all passed. Production compiled-bundle browser smoke returned HTML 200 and successful create/seat with no page errors. Test evidence and explicit limitations saved in TEST_REPORT.md; screenshots inspected and retained. No publish/push/merge performed.
