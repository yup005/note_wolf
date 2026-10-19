# 文档职责与阅读导航

更新：2026-10-19。本页只说明去哪里查阅和如何避免重复，不新增玩法或改变已确认细节。

## 按任务查阅

| 本次任务 | 主文档 | 同时核对 |
|---|---|---|
| Codex 每次开始/结束任务 | [简短指令入口](../AGENTS.md)、[详细工作流程](CODEX_WORKFLOW.md)中的任务前检查、Git 工作流与进度要求 | 当前分支、远程增量、本地修改及任务范围 |
| 当前板子玩法/例外/权限 | [规则规格](WEREWOLF_RULES_SPEC.md)的相关 ID 和完整细节 | [产品决策](PRODUCT_DECISIONS.md)、[最新规则确认及未决问题](../OPEN_QUESTIONS.md)、[详细需求 V1](WEREWOLF_REQUIREMENTS_V1.md) |
| 需求优先级、是否已实现 | [需求总表](NOTE_WOLF_PRODUCT_REQUIREMENTS_MATRIX.md)、[当前项目进度](PROJECT_STATUS_FOR_CHATGPT.md) | 实际代码/测试与[差距审计](GAP_ANALYSIS.md)，不能把索引状态当作验收证据 |
| 紧凑收藏 / 添加和修改记录入口 | [完整展示及权限边界](WEREWOLF_RULES_SPEC.md#record-entry-compact-favorites-2026-10-18)、[使用入口](../README.md) | [验收](WEREWOLF_TEST_CASES.md#收藏与记录入口验收2026-10-18)与当前报告；不增加归档写权限 |
| 夜间6项核心规则复核 | [范围与既有规则](WEREWOLF_RULES_SPEC.md#night-core-acceptance-2026-10-18) | [验收](WEREWOLF_TEST_CASES.md#夜间核心规则复核验收2026-10-18)与报告；NIGHT-006仍待真实声音验收，无新玩法 |
| 默认夜间播报 / 评论弹窗 / 基础诊断 | [当前规则](WEREWOLF_RULES_SPEC.md#voice-comments-diagnostics-2026-10-16)、[故障排查说明](SERVER_DIAGNOSTICS.md) | [直接确认](PRODUCT_DECISIONS.md#voice-comments-diagnostics-2026-10-16)、[验收](WEREWOLF_TEST_CASES.md#语音默认与评论显示故障定位验收2026-10-16)；测试证据不代替实机声音，运维配置未部署 |
| 本地备份恢复 / BETA-010、GAP-06 | [操作与安全边界](DATABASE_BACKUP.md)、[继续范围](PRODUCT_DECISIONS.md#local-backup-delivery-2026-10-15) | [验收](WEREWOLF_TEST_CASES.md#本地备份恢复验收2026-10-15)、当前报告；新文件隔离恢复，生产备份配置仍待完成 |
| 后台监督 / ADMIN-005–007、Owner27 | [管理规则](WEREWOLF_RULES_SPEC.md#admin-oversight-2026-10-14)、[继续授权](PRODUCT_DECISIONS.md#admin-oversight-delivery-2026-10-14) | [验收场景](WEREWOLF_TEST_CASES.md#后台监督管理验收2026-10-14)、当前报告；元信息导出/真实审计/原链接撤销，不新增秘密读取 |
| 通知中心 / NOTICE-001–005 | [通知规则](WEREWOLF_RULES_SPEC.md#notifications-2026-10-14)、[Owner第26项及继续授权](PRODUCT_DECISIONS.md#notification-delivery-2026-10-14) | [验收场景](WEREWOLF_TEST_CASES.md#通知中心验收2026-10-14)、当前报告；独立收藏更新标记，原链接权限，不含通用群发/完整后台 |
| 本人永久删除记录 / ADMIN-008 | [H-004删除边界](WEREWOLF_RULES_SPEC.md#personal-record-deletion-2026-10-14)、[Owner第2项](PRODUCT_DECISIONS.md#owner-decisions-2026-10-12) | [验收场景](WEREWOLF_TEST_CASES.md#个人记录永久删除验收2026-10-14)；与G-003清理实时房间、撤回发布不同；官方事实/其他作者/评论保留 |
| 规则验收/回归 | [验收场景与期望](WEREWOLF_TEST_CASES.md)的相关用例 | 当前确认规则、实际自动测试，以及[验证报告](TEST_REPORT.md)中的结果与限制 |
| 机械狼与装甲狼 Codex 开发需求/验收索引 | [统一实施规格](CODEX_MECHANICAL_BOARDS_IMPLEMENTATION.md) | [机械狼通灵师规则](MECHANICAL_WOLF_SEER.md)、[机械装甲规则](MECHANICAL_ARMOR.md)，以明确的确认/待决标记为准；新需求不等于已实现；[M0–M6进度](MECHANICAL_IMPLEMENTATION_PROGRESS.md) |
| 机械狼／机械装甲开发 | [机械狼需求](MECHANICAL_WOLF_SEER.md)、[装甲规则](MECHANICAL_ARMOR.md) | 已授权实现确认部分；[基础层设计](superpowers/specs/2026-10-10-board-foundation-design.md)、[M2引擎设计](superpowers/specs/2026-10-10-engine-framework-design.md)、当前代码/测试和未决交互，不能把基础模块等同完整板子 |
| 旧操作、提交和测试来源 | [协作历史记录](history/2026-10-10-collaboration-log.md)、相应阶段报告 | 记录的日期/来源提交，历史“本次/当前/未开放”不代表现在 |

## 保留细节，减少重复

- 文档各负其责：决策记录确认与来源；规格保留完整条件、例外和规则 ID；验收清单描述场景与期望；需求总表做索引；代码/测试报告证明实现和实际验证；进度文档记录当前交接。引用主条目，不在每个摘要中复制完整规则。
- 原规格和用例带有历史草案标记。后来**明确确认**的变更以其决策来源为准；更新时间、代码当前行为或缩写摘要都不能自行覆盖规则。没有明确确认的冲突继续保留并说明，不能通过“去重”静默裁决。
- 标准12人预女猎白保持兼容；2026-10-11继续实现机械／装甲／自定义配置的已确认流程。当前完成范围及自动化/实机边界以[阶段进度](MECHANICAL_IMPLEMENTATION_PROGRESS.md)为准；未决交互仍阻断，14人双边白痴已显式选择，黑/白狼王及复制能力已接入，代码交付不代表公网部署或实机验收。
- 整理文档时保留稳定 ID、完整限制/例外、未决细节、证据边界及必要历史；搬移后核对原文与链接。只有语义完全等同的重复可合并。涉及含义变化时走确认与规则维护流程。
- 在本次整理中，规则规格、验收场景、需求总表、产品决策、机械狼讨论稿与 `OPEN_QUESTIONS.md` 均未改正文；原 Codex 详细指令和旧操作记录逐字保留。以后可继续按已授权流程整理，但不能因精简删除细节。
- 多文档/重要章节的大更新（含远程同步增量）后，执行[定期文档复查要求](CODEX_WORKFLOW.md#authorized-documentation-optimization)，在现有进度条目简记结果；小修只做相关检查，不反复复制清单或遍历全部历史报告。

当前临时法官/补录切回/拟态反馈按[现行完整规则](WEREWOLF_RULES_SPEC.md#judge-and-automatic-return-2026-10-13)定位；旧单向切换与待开发说明保留为历史，当前实现和执行证据以最新交接/报告为准。

当前社交评论/基本审核按[完整规则](WEREWOLF_RULES_SPEC.md#community-2026-10-14)和SOCIAL-001–008定位；通知中心按[通知规则](WEREWOLF_RULES_SPEC.md#notifications-2026-10-14)定位，完整后台状态单独在矩阵，不能把消息源覆盖当作全量后台完成。

公开管理记录（GAP-03 / S-003 / S-004）入口、权限、前后值/持久化边界统一见[规则](WEREWOLF_RULES_SPEC.md#management-history-2026-10-17)；[用例](WEREWOLF_TEST_CASES.md#公开管理记录验收2026-10-17)为期望，交接/报告为执行证据。

白天本人身份/技能（S-001 / GAP-05 / Owner5）完整条件见[规则](WEREWOLF_RULES_SPEC.md#day-self-2026-10-17)，[用例](WEREWOLF_TEST_CASES.md#白天本人身份与技能验收2026-10-17)是期望，交接/报告记录实际执行；不混入历史验人或管理者秘密读取。

最终事实复盘（H-002 / RECAP-001 / GAP-04）新写入、公开投影和旧收藏只读兼容统一见[规则](WEREWOLF_RULES_SPEC.md#final-replay-2026-10-17)，[验收](WEREWOLF_TEST_CASES.md#最终事实复盘验收2026-10-17)描述期望，交接/报告记录执行；历史清理与物理擦除未包含。

官方纠错同步（H-002 / RECAP-005/007 / Owner4B）的原发布与当前事实分离、修订历史及原链接边界见[规则](WEREWOLF_RULES_SPEC.md#official-sync-2026-10-18)；[用例](WEREWOLF_TEST_CASES.md#官方纠错同步验收2026-10-18)与报告分别记录期望和执行。

房主未发布官方记录私密收藏（FUTURE-005 / H-003 / Owner6A）的本人权限、原发布隔离及生命周期见[规则](WEREWOLF_RULES_SPEC.md#private-official-favorite-2026-10-18)，[用例](WEREWOLF_TEST_CASES.md#未发布官方记录私密收藏验收2026-10-18)为期望，报告记录实际执行；不增加对外分享或社区读取。
