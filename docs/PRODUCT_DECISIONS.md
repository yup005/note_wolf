# 笔记狼人杀 — 产品决定与对话同步记录

<a id="eleven-dual-2026-10-31"></a>

## 11人白痴双边补充（2026-10-31）

Owner明确“11人也有白痴双边”。将原显式14人/1名真实白痴的资格扩展为11或14人/1名真实白痴；默认不自动开启，其他人数、无真实白痴仍不适用。翻牌神死民活、禁发言/投票/插嘴/再次放逐、后续真实死亡等规则沿用。保留旧存储标识兼容既有14人对局，不扩展机械复制白痴规则。该决定更新B-002/CFG-001/WIN-001/FUTURE-007，不新增需求ID。

<a id="mobile-preparation-2026-10-30"></a>

## 手机候场控件与女孩队友提示（2026-10-30）

Owner指出候场的板子/发牌方式/游戏模式原生下拉不便且易误触，明确选择“按推荐方向直接实现，不再确认设计”：板子展开面板、两种模式用大卡片，点选预览、确认后才生效，取消保留原设置。范围与替代方案见[设计](superpowers/specs/2026-10-30-mobile-preparation-controls-design.md)，使用现有接口及权限，不改变配牌或玩法。

Owner另明确女孩先于狼队行动时应能辨认禁选狼人，并特别限定“入夜前狼女孩不能看到狼同伴，避免场外”：仅首夜本人表白回合的私密视图提供队友提示，身份确认/候场/等待入夜不提前公开。原合法目标禁狼/自己及超时随机非狼保持，其他角色不获得秘密权限。

Owner进一步明确检查无问题后可以直接合并并部署本批，无需再次确认。合并必须等待全量检查和独立审查通过，发布到既有Render服务，部署/实机与自动化证据分开记录；这是本轮授权，不复用之前仅针对PR #8的授权。

<a id="render-release-2026-10-30"></a>

## 合并与部署授权（2026-10-30，工作流）

Owner在首日复查交付后要求部署，并对具体PR #8明确回答“授权合并并部署”。范围为将已验证work正常合并至main，再发布到此前确认的Render My Workspace现有免费试用服务；不授权收费升级、资源增建、改变秘密权限或补造未决规则。运行SHA、完成时间、实际验证及公网网络限制见[部署记录](RENDER_TRIAL.md#当前发布2026-10-30)。这项授权覆盖本次合并/部署，不把原开发阶段授权扩大为未来自动部署。

<a id="wolf-girl-2026-10-30"></a>
## Owner授权狼女孩板子与补充规则（2026-10-30）

Owner要求开发新板并指向[Issue #9](https://github.com/yup005/note_wolf/issues/9)，随后明确“允许首夜自毒”“随机选择非狼人目标”“沿用”（女孩自爆后的普通狼下一夜优先指刀），并批准整份设计：“好，你来实现吧”。批准范围含固定阵容/同阵容副本、新增阶段30秒、后续夜自毒及真狼全灭优先好人胜。完整现行规则统一在[WG-001–010](WEREWOLF_RULES_SPEC.md#wolf-girl-2026-10-30)，不把女孩报复规则套给白狼王或旧板，不授权部署。

<a id="home-panel-recovery-delivery-2026-10-21"></a>

## 首页可选区域恢复修复（2026-10-21，工程维护）

在连续自主开发授权下修复实际复现的既有缺陷：战绩或记录动态模块503会使React整个首页空白。工程选择为三个首页可选区域分别增加局部错误边界，保留原输入与主业务，不自动刷新/重发命令，不新增权限、接口或依赖；不属于新玩法确认，不改172需求行状态或原49确认。

[恢复规则](WEREWOLF_RULES_SPEC.md#home-panel-recovery-2026-10-21)、[期望](WEREWOLF_TEST_CASES.md#home-panel-recovery-tests-2026-10-21)和[实际验证](TEST_REPORT.md)独立维护。此前教学/战绩交付与各自独立审查保持原归属，本批为已有首页流程的小范围修复，由主代理审阅与验证。

<a id="tutorial-delivery-2026-10-21"></a>

## 连续开发：独立合成教学（2026-10-21，TUTORIAL-001）

沿用Owner连续自主授权和[Issue #7原文](NEW_FEATURE_REQUIREMENTS_2026-10-20.md)，不逐阶段等待“继续”。选择完全本地、无真实数据参数的七步教学；不用服务器练习房或管理员测试权限，普通游客可体验标准12人流程，机械/装甲教学留后续。现有标准预言家合法自验、合法本人投票和明确弃票保持，不创设新规则。

动态模块局部失败提示、关闭/后台代际、真实成员/输入/会话隔离及确认后的焦点见[完整边界](WEREWOLF_RULES_SPEC.md#tutorial-2026-10-21)。[设计](superpowers/specs/2026-10-21-tutorial-design.md)、[计划](superpowers/plans/2026-10-21-tutorial.md)、[预期](WEREWOLF_TEST_CASES.md#tutorial-tests-2026-10-21)与[实际](TEST_REPORT.md)分别维护。六项新需求均有本地代码，PWA/实机与生产验收不提升，原49确认/历史保留；不合并部署。

<a id="statistics-delivery-2026-10-21"></a>

## 连续开发：本人战绩（2026-10-21，STATS-001）

沿用Owner连续自主开发授权及[Issue #6原文](NEW_FEATURE_REQUIREMENTS_2026-10-20.md)，不等待逐阶段“继续”，不授权合并/部署或新玩法。工程选择：私密原参赛对应及来源证明、当前账号只读即时聚合、首页按需面板；无VIP条件或他人入口。不能zip旧数组，旧资料无法可靠证明则排除；游客绑定保留多席歧义，本人删除不复活。可靠自动终局及当前官方修订优先关系、未知分母、完整只读链和恢复边界见[现行规则](WEREWOLF_RULES_SPEC.md#statistics-2026-10-21)。

[设计](superpowers/specs/2026-10-21-statistics-design.md)、[计划](superpowers/plans/2026-10-21-statistics.md)、[预期](WEREWOLF_TEST_CASES.md#statistics-tests-2026-10-21)与[实际验证](TEST_REPORT.md)分开维护；随后继续独立合成教学。原49项确认与历史正文保留。

<a id="display-delivery-2026-10-21"></a>

## 连续自主开发与公共大屏（2026-10-21，DISPLAY-001）

Owner明确要求连续开发，不再逐步等待“继续”。该授权覆盖已确认剩余需求的设计、计划、实现、测试和正常提交推送；不代替未定玩法确认，不授权合并/部署。[大屏需求](NEW_FEATURE_REQUIREMENTS_2026-10-20.md)沿用Issue #5；主代理顺序实施并按执行技能仅做最终一次独立只读审查。

工程选择为原房主可撤销随机只读链接、独立白名单投影与固定3秒轮询；不复用玩家Socket或四位号公开查询。无VIP条件，测试房禁止。只读不续期，重开沿用、清理级联；持久事务版本、未知写结果只重读及现有根恢复屏障保护链接生命周期。夜间/敏感白天统一标签，正式死讯/票型才显示，实际秘密与内部版本永不透传。完整[规则](WEREWOLF_RULES_SPEC.md#display-2026-10-21)、[已执行计划](superpowers/plans/2026-10-21-display.md)和[实际证据](TEST_REPORT.md)分开维护；战绩/教学继续独立推进，PWA仍待真实验收。下方历史状态保留原归属，原49项确认不改。

<a id="pwa-delivery-2026-10-20"></a>

## PWA实施授权与交付（2026-10-21交付，PWA-001）

Owner在[设计](superpowers/specs/2026-10-20-pwa-design.md)及[七任务计划](superpowers/plans/2026-10-20-pwa.md)各自交付后回复“继续”，沿用主代理顺序实现、最后一次独立只读审查。沿用已确认后台/断网丢弃未保存编辑、保存后关闭所有窗口升级；本地现已实现，[完整规则](WEREWOLF_RULES_SPEC.md#pwa-2026-10-20)与[执行报告](TEST_REPORT.md)分别记录行为和实际证据。PWA-001待真实iPhone验收，剩余大屏/战绩/教学三项未实现；保留原172个ID、Issue正文及49项确认。

工程裁定：保持批准的干净work托管工作区；仅使用现有sharp，无新依赖或迁移。生产Worker只用构建白名单，真实生产浏览器单独3101/内存库；双版本banner及产物切根只存在测试辅助闭包，无产品测试API/旗标。根恢复统一处理账号完成事件和旧回调的可见性门禁，隐藏时不发新会话读取，不由迟到登录恢复业务。登录/退出后重新校权会关闭旧弹窗与评论，需主动再打开；已保存数据保留。不合并PR、不部署，不把自动化当真实iPhone验收。以下计划未实施等状态是历史。

<a id="pwa-design-approved-2026-10-20"></a>

## PWA设计确认与实施计划（2026-10-20，PWA-001）

Owner在[PWA设计](superpowers/specs/2026-10-20-pwa-design.md)交付、明确询问两项取舍后回复“继续”，确认该设计及后台/断网卸载时丢弃未保存编辑、先保存再关闭所有窗口后升级。已保存服务器草稿与原持久幂等意图保留，不自动提交、保存或发布。该确认不授权缓存秘密、离线玩法、Push或部署。

[完整边界](WEREWOLF_RULES_SPEC.md#pwa-2026-10-20)与[验收期望](WEREWOLF_TEST_CASES.md#pwa-tests-2026-10-20)同步；[七任务实施计划](superpowers/plans/2026-10-20-pwa.md)已写出、待审阅，沿用此前主代理本会话顺序偏好并仅最终安排一次独立审查。尚未写产品代码、注册Worker或执行计划测试，PWA-001仍已确认未实现；172项需求ID及原49项确认历史保留，不合并PR或部署。下方历史交付状态保持原归属。

<a id="rematch-delivery-2026-10-20"></a>

## 同房间多局实施（2026-10-20，REMATCH-001）

Owner 在设计和实施计划分别提交后继续，随后再次继续，确认按已审阅方案由主代理顺序实施并做最终独立审查。功能目标沿用 [Issue #2](NEW_FEATURE_REQUIREMENTS_2026-10-20.md)，不是重新裁定玩法。新增 game 注册/head 与固定归档，旧 ID/版本/私稿/收藏/分享权限保持；原子归档重开、跨局请求与客户端隐私生命周期的[完整规则](WEREWOLF_RULES_SPEC.md#rematch-2026-10-20)和[验收](WEREWOLF_TEST_CASES.md#rematch-tests-2026-10-20)分开维护。

技术裁定：旧手动 commit/history 保留固定首局兼容语义；旧私密法官审计复制到独立归档而不保留运行外键；旧过期归档无板子快照时提供笔记/版本入口，绝不推测板子规则。仅剩回放收藏的老记录也登记，原数据不重写。未实施的PWA/大屏/战绩/教学继续独立，不合并或部署，不提升生产持久化/备份和实机验收。下方新需求导入与规则速查段落为各自交付时历史状态，REMATCH由本段及矩阵现行条目覆盖；49项原确认保留。

<a id="new-issues-2026-10-20"></a>

## 新需求同步与规则速查实施（2026-10-20）

Owner在本聊天要求“继续，你可以看一下新的需求”，随后再次“继续”。实际新需求来自Owner `yup005` 的GitHub Issues #2–#7，而非新main提交；完整原文与对应稳定ID见[新需求来源](NEW_FEATURE_REQUIREMENTS_2026-10-20.md)。六项均是确认需求，只有规则速查GUIDE-001由本批连续实施；REMATCH-001/PWA-001/DISPLAY-001/STATS-001/TUTORIAL-001仍已确认/未实现，不以导入宣称完成，不绑定Render。

GUIDE-001沿用已有版本化玩法，在候场/夜间/白天/手动页增加公开只读目录，实际本人库存沿用已有私密卡；已确认/未知交互仍严格区分，完整[规则与权限](WEREWOLF_RULES_SPEC.md#rule-reference-2026-10-20)及实际验证分开。原166项ID/49历史确认保留，新加6项为172；不合并PR或部署。

## 继续实施：未来投票设置差异对照（2026-10-19）

Owner再次“继续开发”，沿用连续实施授权，补齐既有S-003 / RESUME-009两项现有未来投票设置的新旧差异、未变项及已保存值初始化。管理者按版本读取与失败/迟到响应保护为工程方案，沿用既有权限和公开审计；未增加可配置参数或裁定新玩法。完整[边界](WEREWOLF_RULES_SPEC.md#future-vote-diff-2026-10-19)与实际执行分开；更广参数仍待明确，RESUME-009保持部分实现，49项历史确认不改，不部署。

## Owner直接反馈：缩紧收藏、明确记录入口（2026-10-18）

Owner要求“我的收藏”减少空间占用，并指出难以找到添加或修改记录。采用默认3条/筛选收起与展开全部、首页“我的记录→添加 / 编辑记录→选择对局”直达原编辑器、笔记及保存置前；完整行为及既有写权限边界见[规格](WEREWOLF_RULES_SPEC.md#record-entry-compact-favorites-2026-10-18)。这是本次直接UI授权，不补造未确认游戏规则，不将运行房间入口称为归档编辑功能。49项历史确认保留，实际验证见报告，不部署。

<a id="private-official-favorite-delivery-2026-10-18"></a>

## 继续实施：房主私密收藏（2026-10-18）

Owner再次“继续”，沿用连续实施及不重复询问指示，落实第一轮第6项A/H-003/FUTURE-005：赛后房主免费收藏自己未发布的官方记录，保持仅本人可见，不借收藏取得发布、对外分享或评论授权。复用收藏关系、独立私稿读取和只读按需弹窗为工程方案；显式首次发布才转为既有发布入口，游戏中收藏/私人正文搜索不由本批扩展。完整条件见[规则](WEREWOLF_RULES_SPEC.md#private-official-favorite-2026-10-18)，实际验证另见报告；49项原确认保留，不部署。


<a id="official-sync-delivery-2026-10-18"></a>

## 继续实施：官方纠错对外同步（2026-10-18）

Owner再次“继续”，沿用连续实施及不重复询问指示，落实第一轮第4项B/H-002：已提交官方事实及修订自动反映在有权读取的官方帖子、有效分享和原链接收藏；个人推理仍以显式发布版本为准，私人草稿/个人VIP版本不覆盖。采用独立只读官方修订投影及原发布事实折叠展示为工程方案，不新增授权、修改发布版本、改变胜负规则或历史清理策略。完整条件见[规则](WEREWOLF_RULES_SPEC.md#official-sync-2026-10-18)，实际验证另见报告；49项原确认保留，不部署。


<a id="final-replay-delivery-2026-10-17"></a>

## 当前实施范围：最终有效事实复盘（2026-10-17）

Owner再次“继续”，沿用不重复询问的连续实施指示，落实第一轮第3项A、H-002与GAP-04：新日志不逐次保存狼队改票输入，赛后接口/自动收藏只提供最终有效事实。既有历史采用只读兼容投影，不直接删除或重写原始运行历史/收藏；个人草稿、发布版本、官方纠错和管理审计保持独立。现有技能结果、票型、权限和计时不改变，不配置内部日志保留期限或历史清理策略。完整条件见[规则](WEREWOLF_RULES_SPEC.md#final-replay-2026-10-17)，实际验证见交接/报告；49项原确认保留，不部署。

<a id="day-self-delivery-2026-10-17"></a>

## 当前实施范围：白天本人身份与技能（2026-10-17）

Owner再次“继续”，沿用连续实施/不重复询问指示，落实既有第一轮第5项A、S-001及GAP-05：白天本人按需查看身份和真实剩余技能，不重新调取历史验人结果。扩展现有私密日间流程，默认收起，切后台/阶段/连接或账号房间变化丢弃；当前管理权限不用于代看他人。投射现有库存和已知学习身份，不新增技能、改变消耗/发动资格或解除未定义交互。完整条件见[规则](WEREWOLF_RULES_SPEC.md#day-self-2026-10-17)，实际验证以交接/报告为准，49项历史确认保留，不部署。

<a id="management-history-delivery-2026-10-17"></a>

## 当前实施范围：公开管理记录（2026-10-17）

Owner再次“继续”，沿用连续实施及不重复询问指示，补齐既有S-003/S-004与GAP-03：暂停、恢复、临时房主授权/收回、未来投票默认设置及实际房主接管警徽的持久公开审计。记录实际操作者、时间和公开前后值；只有当前本局管理者可读，不增加普通管理员或历史归档访问权。20条分页、按需界面及撤权/读取失败清除为工程默认；不补造旧日志、不修改玩法。完整条件见[规则](WEREWOLF_RULES_SPEC.md#management-history-2026-10-17)，实际执行另见交接/报告。更广的未来参数配置仍待明确，原49项确认保留，不部署。

<a id="voice-comments-diagnostics-2026-10-16"></a>

## 当前实施范围：默认夜间播报、评论弹窗修复与基础诊断（2026-10-16）

Owner继续实施后反馈“评论显示有问题”，截图显示记录弹窗评论按钮越出白色卡片；修复仅调整该记录弹窗整体滚动和内容不压缩。随后明确“默认开启播报”及“请闭眼后，不需要语音播报等待下一阶段”：无关闭偏好的设备默认准备夜间播报，复用房主/有效管理者已有交互解锁音频，仍受浏览器手势、前台、当前管理权限和单设备租约约束；手动关闭保留为本设备偏好。夜间闭眼间隔只说“请闭眼”，不改5秒间隔、其他夜间时长或白天静音。

原继续范围推进BETA-011/GAP-06最小故障定位：脱敏关联编号、粗公开阶段、读取健康探针及后台异常保护；不扩大管理员秘密权限，不代定日志保留/外部告警或生产配置。完整边界见[规则](WEREWOLF_RULES_SPEC.md#voice-comments-diagnostics-2026-10-16)与[操作说明](SERVER_DIAGNOSTICS.md)，执行与实机限制另见报告。沿用不重复确认的连续授权，原49项确认不改，不部署。

<a id="local-backup-delivery-2026-10-15"></a>

## 当前实施范围：本地备份与隔离恢复（2026-10-15）

Owner在后台管理交付后再次“继续”，沿用连续实施/不重复询问指示，推进BETA-010/GAP-06既有本地备份及隔离恢复要求。实现一致性快照、摘要/完整性/外键校验、仅新目标恢复和合成数据演练；明确输入源、私有目录/文件、禁止覆盖及不输出私密内容为工程默认。只增加本地文件运维工具，不扩大应用管理员权限、修改游戏规则或直接恢复真实运行库。正式持久存储、备份周期/保留/加密/异机目的地、恢复目标与生产切换未决定，不由本批代定；不部署。完整条件见[操作说明](DATABASE_BACKUP.md)，执行见[交接](PROJECT_STATUS_FOR_CHATGPT.md)与[报告](TEST_REPORT.md)，49项历史确认原文保留。

<a id="admin-oversight-delivery-2026-10-14"></a>

## 当前实施范围：后台监督管理（2026-10-14）

Owner在通知批次交付后再次“继续”，沿用连续实施/不重复询问指示，补齐H-004/ADMIN-005–007既有后台范围及第一轮第27项：举报人数汇总、昵称/日期/处罚类别/处理状态筛选导出、实际管理员操作日志、填写原因并留审计后撤销他人违规公开分享。不授权读取未发布私稿/进行中秘密，不增加永久禁止作者重生成链接的政策。

本批在现有后台上扩展；举报按内容汇总及最新举报时间筛选、CSV上限/公式防护和原请求重试为明确工程默认。完整条件见[现行管理规格](WEREWOLF_RULES_SPEC.md#admin-oversight-2026-10-14)，实际实现/验证/发布以[交接](PROJECT_STATUS_FOR_CHATGPT.md)及[报告](TEST_REPORT.md)为准。49项原确认保留；通用群发/支付/正式持久存储/实机和部署不纳入本批。

<a id="notification-delivery-2026-10-14"></a>

## 当前实施范围：通知中心（2026-10-14）

Owner在永久删除批次交付后回复“继续”，沿用“都允许，你别问我了”推进已确认H-004/NOTICE-001–005。第一轮第26项明确复盘更新/回复/点赞默认关闭、主动订阅，账号/处罚消息保留，30天、回复逐条/点赞合并不变；本批不重新询问已答复决定。旧DEC-15默认策略待确认已由第26项覆盖，49项历史来源保留。

工程入口、来源权限/去重/已看标记/重试和清理边界统一见[规则](WEREWOLF_RULES_SPEC.md#notifications-2026-10-14)，执行证据见[交接](PROJECT_STATUS_FOR_CHATGPT.md)。通用管理员群发、完整非社区审计/统计、持久存储和实机/部署不由本批标为完成；不读取真实玩家数据或改变Render开关。

> Updated: 2026-10-16 (America/Los_Angeles)
> This document records **product-relevant confirmed decisions and current planning**, not the raw ChatGPT conversation.  
> **Source note:** The 2026-10-10 product status below was provided by the project owner as a handoff summary. It is **not** verified against the older GitHub `main` snapshot or by re-running tests.

<a id="night-only-and-role-tags-2026-10-13"></a>

## 仅夜间播报与按钮式角色配置（2026-10-13，直接补充）

Owner先要求警長当选只在竞选和警徽移交后各播一次，随后明确更新为“白天的内容其实都不需要语音播报，只有夜间需要语音播报功能”；最新要求覆盖此前白天竞选/当选、投票、死讯、技能询问、遗言、警徽、自由发言、插话及胜负的自动语音。白天页面与游戏事实继续保留，语音入口不显示，进入白天停止当前音源及租约。Owner另确认“天黑请闭眼”在刚入夜、机械狼确认状态之前播报，狼人行动阶段不重复；标准板首阶段就是狼人时仍先播入夜提示再喊狼人。

Owner要求自定义调整改为角色标签按钮：点击加入/再次点击移除；仅普通狼人和村民有加减数量，其他标签最多加入1名，人数自动求和。白痴规则仅在包含白痴时出现；移除白痴或不再满足14人双边条件时恢复默认。该新增入口规则不删除旧已保存的重复黑/白狼王配置，也不改已确认的重复狼王引擎/档案能力；旧数量显示准确，点击标签移除后重新加入为1名。不新增其它板子、评论或权限。

详细规格见[本批规则](WEREWOLF_RULES_SPEC.md#night-only-and-role-tags-2026-10-13)，自动与实机证据见[交接](PROJECT_STATUS_FOR_CHATGPT.md)和[报告](TEST_REPORT.md)。前49项及旧确认原文保留，不部署。

<a id="recorded-voice-and-authority-2026-10-12"></a>

## 预录中文语音与权限确认时长（2026-10-12，直接补充）

Owner在本地测试反馈13号卡片末行较小、身份确认停在12/13及实际没有声音，并明确要求预先录制系统语音，之后直接调用录音、不每次生成；音量已最大。Owner另确认“狼刀权限确认”15秒即可，覆盖该阶段原30秒代码默认；不改其他夜晚时长或5秒闭眼间隔。前49项问卷原条目保留，此为后续直接确认。

因此默认使用预录中文公开提示与可重用数字片段，设备手势开启、静态本地资源解码缓存/拼接；保留原浏览器语音作为显式替代。没有第三方生成服务、麦克风或运行时秘密文本录音。房主/有效临时房主与单标签租约不变，后台/失权/旧阶段停止。13席确认仍要求真实房主本人确认，测试玩家的自动确认不替代房主；补充清晰提示并修正扩展行等高。规则见[本批规格](WEREWOLF_RULES_SPEC.md#recorded-voice-and-authority-2026-10-12)，实际检查及实机边界见[交接](PROJECT_STATUS_FOR_CHATGPT.md)和[报告](TEST_REPORT.md)。不部署。

<a id="wolf-kings-delivery-2026-10-12"></a>

## 黑白狼王实施范围（2026-10-12）

Owner在双边白痴批次完成后回复“继续”，按既定下一批实现第20、28–36、44–45项已经确认的黑/白狼王及机械/装甲复制能力；沿用此前“都允许，你别问我了”的连续执行指示，不重复询问已回答规则。角色目录、重复配置、共享刀组、真实阵营、完整黑枪触发、胜利优先白带人及吞毒不能带人按原确认落地。正式规则见[狼王规格](WEREWOLF_RULES_SPEC.md#wolf-kings-2026-10-12)，实施/执行证据见[交接](PROJECT_STATUS_FOR_CHATGPT.md)与[报告](TEST_REPORT.md)。历史问卷原文保留；第37项普通预言家复制反馈、法官/手动切回、未定义未来交互不随此标为完成。不部署、不声明实机验收。

<a id="dual-idiot-delivery-2026-10-12"></a>

## 14 人双边白痴与配牌边界实施确认（2026-10-12）

来源：Owner先确认本批优先开发范围，再回复“开始”；沿用第一轮第11、12、17–19项及2026-10-10双边分类确认。实现使用独立 `idiotPolicy` 选项，仅14人且有一名真实白痴可选；不按人数自动启用，不改变标准12人或机械白痴的既有额外夜。翻牌神边算死、民边仍活，无发言/插嘴/投票权且不能再次放逐；后续实际死亡单独结算。正式期望与回归见 [B-002及配置规则](WEREWOLF_RULES_SPEC.md#双边白痴与配牌边界2026-10-12)、[验收](WEREWOLF_TEST_CASES.md#双边白痴与配牌边界验收2026-10-12)。

新增明确答复：针对无狼手动记录的结束方式，Owner选择“房主确认结束记录，不判胜负；结束后可发布”。因此仅无任何狼角色的手动记录开放版本校验和再次确认的“结束记录”；胜方保持空，状态标注“不判胜负”，不猜测好人胜或狼胜，不给有狼对局此入口。结束来源、官方事实、修订和发布历史独立保留，房间清理/重启不丢失。本条补齐第11项没有定义的结束方式，不改变其他正常胜利或人工裁定规则。

本批仍暂不部署；实机验收独立。代码与实际执行结果见 [最新交接](PROJECT_STATUS_FOR_CHATGPT.md) 和 [验证报告](TEST_REPORT.md)，历史49项问卷原文保留，其他已确认而尚未实现的狼王/法官/切回流程不随本批标为完成。

<a id="personal-record-deletion-delivery-2026-10-14"></a>

## 当前实施范围：个人记录永久删除（2026-10-14）

Owner在评论批次交付后继续回复“继续”，按先前第三项推荐推进永久删除；沿用“都允许，你别问我了”的连续实施指示。范围来自第一轮第2项和H-004/ADMIN-008：本人二次确认删除草稿/全部本人发布版本及相关分享，保留已采纳官方事实、其他作者记录和对局级评论；不扩大为清空对局或管理员代删私人记录。

工程入口、状态校验/重试、删除标记、旧申请归属例外和实机边界见[现行规则](WEREWOLF_RULES_SPEC.md#personal-record-deletion-2026-10-14)，实际执行结果见[交接](PROJECT_STATUS_FOR_CHATGPT.md)。开发不操作真实用户记录，不部署、不改变Render开关；完整通知中心等仍留后续。第2项原文和49项历史确认保留。

<a id="community-delivery-2026-10-14"></a>

## 当前实施范围：评论与基本审核（2026-10-14）

Owner在法官批次交付后回复“继续”，按此前第二项推荐开发评论，并再次“继续”。本批依据已确认H-003/H-004、SOCIAL-001–008和第23–26项，不重新裁决玩法；评论同时具备最小举报/删除/警告/禁评/审计闭环，处罚消息在本人账号中可见。完整通知订阅/中心、永久删除记录、其他后台管理和部署不在本批。

当前工程行为与默认边界统一见[现行规则](WEREWOLF_RULES_SPEC.md#community-2026-10-14)，执行证据见[交接](PROJECT_STATUS_FOR_CHATGPT.md)。公开评论仅昵称/纯文本，作者账号ID不由头像泄露；禁评不影响游戏，保护性举报保留。旧“未实现”是当次历史，通知默认关闭的第26项保持。

<a id="judge-delivery-2026-10-13"></a>

## 当前实施范围：临时法官与补录切回（2026-10-13）

Owner在推荐“临时法官、法官补录、手动切回自动、普通预言家拟态反馈”为下一批后回复“做吧”，授权本核心流程批次。规则使用第二轮37/39–40、第三轮42–46及第四轮47–49合并后的确认；不新增角色规则。评论、永久删除、通知和部署未纳入本批。

当前实施条件与历史覆盖统一见[现行规则](WEREWOLF_RULES_SPEC.md#judge-and-automatic-return-2026-10-13)，验证证据见[交接](PROJECT_STATUS_FOR_CHATGPT.md)。下方各轮“仅需求/尚未开发”是当次同步历史，不再代表上述功能的当前实施状态；未提出的未来交互仍阻断，仍不部署。

<a id="owner-decisions-2026-10-12-round4"></a>

## 最新确认：临时法官资格与主持权限（2026-10-12，第四轮47–49项）

来源：Owner回复“AAA”，按上一轮题号对应47A、48A、49A。日期按America/Los_Angeles。本节明确覆盖第三轮法官资格/玩家权利/公开主持权待决描述；前49项本轮问卷均有Owner答复，但未来新增角色和未提出的具体交互仍不得自行定规则。只更新需求，不标代码已实现，继续暂不部署。

| 原问题号 | Owner回答 | 已确认要求 |
|---|---|---|
| 47 | A | 临时法官候选仅限已公开死亡、且待执行死亡技能已处理完的玩家；不能选择尚未公开的夜间死者，也不采用存活玩家退出参赛转法官方案。 |
| 48 | A | 白痴等死亡玩家任职法官后，不保留玩家插嘴权，只负责法官工作；法官的公开主持发言不作为玩家插嘴。 |
| 49 | A | 有效临时法官可暂停、恢复和推进公开流程，不只负责秘密查看和补录。 |

### 与前轮决定合并后的法官模型

- 房主在游戏过程中选择上述合资格死亡玩家担任本局临时法官；此角色区别于原来必须存活的临时房主与运营管理员，不应复用其“存活才能主持”限制。
- 当前有效临时法官可查看本局全部身份、秘密技能历史和库存，补录手动期间事实并协助切回自动；该秘密权限来自显式任命，不授予所有死亡玩家、普通参赛房主或运营管理员。
- 任职者不再使用玩家插嘴权；不得因担任法官重新获得正常玩家操作或代操作存活玩家的自动秘密技能。原角色死亡与胜利归属不因任职改变。
- 任命及实际补录/公开管理动作必须按既有已确认审计要求记录操作者。会话、任命失效和接口隔离属于实施验证，不能让未获当前授权的会话继续读取秘密。
- 切回自动依前轮确认，可在任意暂停阶段发起，由法官补录；恢复阶段重新给予完整默认计时，保留已完成操作，不能重复消耗或执行技能。

本批基线main为 `0d9c29137ae760074d2d16adb31b49b38861ecfb`；仅同步三份需求索引文档，保留完整历史来源。没有功能代码、数据库、测试或部署变更；后续实施须先对照最新代码与当前确认需求。

<a id="owner-decisions-2026-10-12-round3"></a>

## 最新确认：局中临时法官与切回计时（2026-10-12，第三轮42–46项）

来源：Owner回复42“我们一般会让死了的玩家充当临时法官, 这个可以在游戏过程中由房主选择”、43A、44A、45B、46B。按America/Los_Angeles记日期。本节覆盖第一/二轮同范围待决描述；只更新需求，不代表功能已实现，继续暂不部署。

| 原问题号 | Owner回答 | 已确认要求 |
|---|---|---|
| 42 | 房主在局中选择；一般由死亡玩家担任 | 临时法官由房主在游戏过程中指定，通常选已死亡玩家；不是仅建房时预设的独立法官。是否严格只限已公开死亡且无待执行玩家技能、任职后插嘴权如何处理，尚需确认。不能把“一般”自动写成已确认的绝对资格限制。 |
| 43 | A | 当前有效临时法官可以查看本局全部身份、秘密技能历史与库存，以支持法官补录。此为房主明确授权的局内法官权限例外，不开放给所有死亡玩家、普通参赛房主或运营管理员；查看/补录不等于可代操作仍在自动执行的玩家技能。 |
| 44 | A | 机械狼/装甲狼学习白狼王后，学习当夜结束后的首个白天即可按合法自爆时段自爆带人，不必再等待一个夜晚。此确认替代上一轮复制白狼王生效时点待决。 |
| 45 | B | 白狼王已中毒、尚未公告死讯时，警上允许吞毒自爆，但不能带人；不因学习白狼王或一般自爆带人规则绕过这个毒杀分支。最后一狼仍先判胜，终局立即停止后续动作。 |
| 46 | B | 手动切回自动后，当前恢复阶段重新给予完整默认时长；已完成/已提交操作保留，不重复执行或消耗技能。阶段重新计时为明确选择，覆盖此前仅讨论的恢复原剩余时间方案。 |

### 法官授权的边界

局内临时法官是新的显式授权对象，与原“存活临时房主”及运营管理员不同。其秘密读取仅在本局有效任命期间成立，任命不能使所有死亡玩家或普通账号获得身份读取。需在实施中验证任命、权限变更、旧会话撤权、记录实际补录操作者以及公开/私密接口隔离；具体保留期限和权限实现是设计工作，不伪装为Owner已经逐项确认的规则。

仍需明确：法官严格候选资格/未完成死亡技能、任职后的白痴插嘴等玩家权利，以及是否同时具有暂停/恢复/推进等公开主持权。此前禁止管理员任意读秘密继续有效；参赛房主是否成为法官并非本轮自动授权。不能通过任命或事实修正将已知全部秘密的法官无条件恢复为正常存活玩家。

本批基线main为 `ea234cccaf1ea0fbfb2fea92060ffa235a497ac4`。保留全部历史确认与代码证据；未修改源代码、测试、数据库、部署或线上开关。

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

- **2026-10-25 — Owner deployment request / BETA-009 / BETA-004:** Deploy the current verified version to the existing Render Free trial. Source `37a13140a6cfe824d9a8c24a43caf31f6f069324` is live; enable the previously confirmed exact-service administrator-only independent simulated-room exception after authorization/isolation verification. Preserve bootstrap credentials, Free plan and manual deployment settings. No new gameplay rules, paid upgrade or live database upload. [Deployment and actual verification](RENDER_TRIAL.md#当前发布2026-10-25).

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
