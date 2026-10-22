# Personal Statistics Implementation Plan

> Use superpowers:executing-plans for native sequential execution. Owner explicitly authorizes continuous autonomous work; no staged approval pauses. Only the final whole-feature independent readonly reviewer is delegated under the execution skill.

**Goal:** STATS-001本人已结束普通对局战绩。
**Spec:** [完整设计](../specs/2026-10-21-statistics-design.md)。
**Architecture:** 私密归档对应/来源证明、原官方事实准入、纯函数聚合、当前账号只读API与首页按需面板。
**Tech:** 现有Node24/TypeScript/React/SQLite/Playwright，无新增依赖。

## Constraints and Review Focus

进行中/模拟/未知旧身份来源不影响输出；不zip旧数组，不用当前角色替历史角色；游客绑定保留多席歧义；本人删除不复活；官方结果而非私稿/旧帖子；未知胜负/本人阵营不进分母；无他人入口/持久计数/PWA响应缓存，无合并部署。

### Task 1: 私密对应与聚合

Files packages/contracts/statistics.ts、packages/domain/statistics.ts、packages/storage/participation.ts；tests/statistics-domain.test.ts、tests/participation.test.ts。
Interfaces PlayerStatistics/StatisticsEvidence、aggregateStatistics、ParticipationStore(db).capture/identity/backfillLive/games。
- [x] 先将探索断言落真实仓库并运行缺模块RED，保留/tmp设计试验归属，不算产品已验证。
- [x] 实现白名单聚合、普通/测试来源与原席位对应证明；非法/损坏/过期旧档案和多席歧义拒绝猜测。
- [x] 真实仓库专项和typecheck GREEN，初始化/重启/清理与接口契约核对。

### Task 2: 官方事实及身份迁移

Files packages/storage/records.ts、auth.ts、lobby.ts；tests/statistics-server.test.ts及必要现有回归。
Interfaces RecordsStore.statistics(token)、LobbyStore.statistics(token)；原start/capture事务及AuthStore.link迁移hook。
- [x] 写开始捕获、游客绑定/歧义、终局门禁/多局/重复读取、本人删除重建、官方纠错/私稿/未知/测试/备份恢复的真实存储RED。
- [x] 接原开始与安全实时回填；原账号迁移同事务复制证明，终局后只读当前官方事实，未知阵营与胜负保守处理。
- [x] 专项GREEN，回归原Auth/Records/Rematch/备份；进行中私密变化输出完全不变。

### Task 3: 当前账号API与按需界面

Files apps/server/app.ts、apps/web/src/StatisticsPanel.tsx/statistics.css、App.tsx、RecordDeleteDialog.tsx；tests/e2e/statistics.spec.ts和生产PWA缓存扩展。
Interfaces GET /api/my-stats；StatisticsPanel({accountId})；成功本人删除无载荷失效事件。
- [x] 写账号/游客/失权/他人选择器HTTP、收起零请求、真实终局/切账号/后台/迟到/手机/删除界面RED。
- [x] 实现严格当前账号读取、6秒超时/代际/失败清空与手动刷新、成功删除清空重读；原根恢复与限流不变，未保存输入无统计写入。
- [x] 相关浏览器/HTTP/typecheck GREEN，实际Worker仍不缓存统计地址/响应。

### Task 4: 整体验证与交付

Files 规则/期望/矩阵/决策/README/报告/交接/导航及本设计/计划。
- [x] npm test/typecheck/build，完整开发E2E及生产PWA，记录真实pass/fail/skip和中间失败，不混加重复专项。
- [x] 最终唯一新鲜独立只读整体审查（执行技能明确授权）；具体问题RED→GREEN，不重复审查。
- [x] 同步STATS-001实际状态与证据，保留172ID/原166/49历史确认/Issue原文；文档引用/语义职责/差异检查。
- [x] 完整批次正常提交推送work并核对SHA/干净树，更新附加草稿PR8，记录实施SHA；不部署合并，继续教学。
