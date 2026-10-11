# 准备与私密发牌 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user selects delegation. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 完成房主参赛、12 人准备、独立模式配置、两种私密发牌及身份锁定的第一阶段流程。

**Architecture:** 沿用 SQLite、HTTP 和 Socket.IO。准备领域模块负责条件、洗牌与校验；存储层事务负责状态和权限；公共投影与私人身份接口分开。React 只呈现服务器状态。

**Tech Stack:** Node >=24、TypeScript、React、Express、better-sqlite3、Socket.IO、Zod、Playwright；不新增外部服务或产品依赖。

**Spec:** `docs/superpowers/specs/2026-10-09-werewolf-preparation-design.md`

## Global Constraints

- 产品名称：笔记狼人杀；简洁中文文案，白色浅灰圆角卡片，深灰主按钮。
- 房主必须占座参赛；12 座齐全且全员准备后才能发牌。
- 发牌前本人可换空位或取消入座；发牌后锁定座位和配置。
- 线上随机 / 实体录入与自动法官 / 纯手动记录独立配置，默认线上随机和自动法官。
- 每人只操作自己的身份；管理权限不授予秘密信息读取或代操作权限。
- 本轮不开夜间、记录器或复盘；开局后明确显示后续模块尚未开放。
- 三个未决规则继续 unresolved；不添加默认流程。
- 辅助文字对比度至少 4.5:1，输入字号至少 16px，触控目标至少 44px。

## Review Focus

- 已有 SQLite 文件：升级保留原房间、成员、cookie 和座位，不能只测空库（任务 2）。
- 设置或座位更新与准备请求交错：发牌只能使用当前配置的准备状态（任务 2、3）。
- 响应丢失与并发重试：只有一副牌和一次开局，不重抽身份（任务 2、3）。
- 实体身份校验竞争：最后一次提交与开始请求事务串行，不锁定错误牌组（任务 2、3）。
- 页面隐藏、刷新和旧快照：秘密内容收起且状态不倒退（任务 4、5）。

## 文件职责

- `packages/domain/preparation.ts`：角色枚举、准备条件、牌组生成与数量校验，不依赖 React / SQLite。
- `packages/contracts/index.ts`：请求 schema、公共准备字段、本人身份类型与错误文案。
- `packages/storage/preparation.ts`：准备存储事务、私人投影；复用 LobbyStore 的同一数据库连接与会话成员查询。
- `packages/storage/lobby.ts`：增量迁移、座位变更、公共快照，向准备存储提供内部数据库 / 鉴权上下文。
- `apps/server/app.ts`：新增同源鉴权路由与公共广播。
- `apps/web/src/PreparationPanel.tsx`、`IdentityPanel.tsx`：配置与准备、私人身份界面。
- `apps/web/src/App.tsx`、`RoomLobby.tsx`、`useRoom.ts`、`style.css`：状态衔接、重连、移动布局。
- `tests/preparation.test.ts`、`tests/preparation-server.test.ts`、`tests/e2e/preparation.spec.ts`：领域 / 存储、网络权限、完整浏览器流程。

### Task 1: 领域与契约

**Interfaces:**
- `Role = 'wolf'|'villager'|'seer'|'witch'|'hunter'|'idiot'`。
- `RoomSettings = {dealMethod:'online'|'physical';gameMode:'automatic'|'manual'}`。
- `PreparationState = {phase:'lobby'|'identity_collection'|'started';settings:RoomSettings;submittedCount:number;confirmedCount:number;validation:'waiting'|'valid'|'mismatch'}`。
- `PrivateIdentity = {role:Role|null;confirmed:boolean;locked:boolean}`。
- `PublicSeat` 增加 `ready:boolean`；`RoomSnapshot` 增加 `preparation:PreparationState`。
- `createDeck():Role[]`、`rolesMatchBoard(roles:readonly Role[]):boolean`；`assertCanDeal(seats:readonly PublicSeat[]):void`。

- [x] 写领域失败测试：长度 12，4 狼 / 4 民 / 四神各 1；缺人、房主不在座、有人未准备全部拒绝；错误角色数量拒绝。
- [x] 执行 `node --import tsx --test tests/preparation.test.ts`，确认因接口未实现失败。
- [x] 实现领域与 Zod schema：settings、ready 布尔值、role 枚举，拒绝未知请求字段；用 `randomInt` 洗牌，逻辑不写入组件。
- [x] 运行领域测试与 `npm run typecheck`，确认通过。

### Task 2: 迁移、换座与准备存储

**Interfaces:** 以下由 `LobbyStore` 暴露，准备方法委托独立存储模块；返回 `LobbyView`。
- `configure(token:string,roomId:string,settings:RoomSettings):LobbyView`
- `setReady(token:string,roomId:string,ready:boolean):LobbyView`
- `unseat(token:string,roomId:string):LobbyView`；原 `select` 支持大厅内原子换空位。
- `deal(token:string,roomId:string):LobbyView`
- `identity(token:string,roomId:string):PrivateIdentity`
- `submitIdentity(token:string,roomId:string,role:Role):PrivateIdentity`
- `confirmIdentity(token:string,roomId:string):PrivateIdentity`
- `start(token:string,roomId:string):LobbyView`

- [x] 补存储失败测试：旧结构 SQLite 文件升级后保持 cookie / 房间 / 座位；换座保留单人单座、目标冲突保留旧座；取消座位清除准备；非本人 / 非房主操作拒绝。
- [x] 补准备测试：四种设置组合；设置改变清全员准备、同设置不清；发牌条件全部成立才成功；发牌后不能改设置或座位。
- [x] 补身份测试：线上牌持久化、重复 deal / start 幂等；仅本人读写；实体全员错误文案相同、修正后匹配、started 后不可修正；未占座访客没有身份。
- [x] 运行测试确认失败，再实现增量迁移、准备与秘密身份表及事务。事务内鉴权和阶段检查；公开 snapshot 只投影总人数 / 校验状态。
- [x] 补真实文件关闭 / 重开测试，断言 12 人身份与发牌前后相同；并发 start / role correction 不会锁定不匹配状态。
- [x] 更新旧首次占座测试为新已批准换座语义；运行 `npm test` 和 typecheck。

### Task 3: HTTP 与实时权限

**Interfaces:** 路径前缀 `/api/rooms/:id`。
- `POST /settings`，body RoomSettings；`POST /ready`，body `{ready:boolean}`。
- `POST /unseat`、`POST /deal`、`POST /start`，body `{}`。
- `GET /identity`；`POST /identity`，body `{role:Role}`；`POST /identity/confirm`，body `{}`。
- 业务操作后广播 `room:snapshot` 公共投影；identity 路由不接受他人 memberId / seat 参数。

- [x] 新建真实 HTTP / Socket.IO 失败测试：12 个独立 session 准备；非房主修改设置 / 发牌 / 开始拒绝；陌生 session 读身份拒绝。
- [x] 验证恶意请求携带 memberId、seat、role 等多余字段不能代操作；查询参数指定他人身份必须拒绝；不存在的秘密路由返回 404。
- [x] 捕获 session、room 与 Socket.IO 所有公共载荷，断言不存在 role、角色分布或秘密表内容；房主身份接口只返回房主自己的牌。
- [x] 验证实体不匹配：所有公共快照一致，不指出错误者；修改 / 开局并发与重复请求维持约束。
- [x] 执行测试确认失败，接入存储方法、strict schema、no-store 响应和广播，再运行 `npm test`。

### Task 4: 手机准备与私人身份 UI

**Interfaces:**
- `PreparationPanel({view,busy,connected,onConfigure,onReady,onDeal,onStart})`。
- `IdentityPanel({roomId,phase,onPublicRefresh})`；从私人接口加载，不从公共 room 寻找角色。
- App 的业务动作共用请求锁、错误处理和 revision 比较；重连重新读取本人状态。

- [x] 写浏览器失败测试：房主选座、选择四种模式、准备 / 取消准备；玩家不能看到房主设置按钮；发牌前本人能换座。
- [x] 实现紧凑配置、准备人数、明确阻塞原因；开始发牌和开始对局按钮不混用。
- [x] 实现线上私人查看 / 隐藏 / 确认与实体私人选择 / 提交；visibilitychange、phase / room 变化隐藏身份并重新鉴权取最新状态。身份不存 localStorage。
- [x] 公共显示统一等待或“角色数量不匹配，请各自检查身份”；started 阶段显示身份已锁定、对应对局模块待开放，不展示夜间假倒计时。
- [x] 加强文字对比度、16px 输入、44px 触控、安全区域；手机保留板子数量摘要；用 react-best-practices 检查新增组件。
- [x] 运行 `npm run build` 与浏览器用例，确认通过。

### Task 5: 全流程与复测

- [x] 独立 browser contexts 组成 12 名玩家（房主计入）：线上发牌 / 私人确认 / 开局 / 刷新身份不变；第二房间实体录入 / 不匹配 / 修正 / 开局锁定。
- [x] 新增复测：发牌响应丢失后重试，不重抽；开局后刷新不重复玩家；断线后同步身份状态；手机切页面隐藏身份。
- [x] 保留已有大厅 4 项 E2E；新换座语义如影响按钮期望则按设计更新断言，不降低座位竞争覆盖。
- [x] 四组合存储 / HTTP 全覆盖，Chrome 手机尺寸跑全流程；WebKit 可用时追加，缺失则报告未测，不能以 Chrome 代称 Safari。
- [x] 最终执行 `npm test`、`npm run typecheck`、`npm run build`、使用本机 Chrome 的 `npm run test:e2e`。有失败时先调查，再复测相关范围。
- [x] 审阅公共 payload、服务端权限、事务边界和 UI 遮罩；不将构建成功当作秘密隔离证据。

### Task 6: 文档与本机交付

- [x] 更新 README、OPEN_QUESTIONS、PROGRESS 与 TEST_REPORT：第一阶段实际范围、换座已确认、三个未决规则继续保留、设备接管 / 夜间 / 记录器未做。
- [x] 将审计表本轮涉及项标为已实现 / 部分实现 / 未测，并附测试范围；保留原审计日期与原始观察。
- [x] 启动本机 3000 服务（已有服务时先确认项目与监听进程，避免抢端口），验证 health 与页面；说明同一局域网手机使用电脑 IP、不同设备独立会话、普通 HTTP 剪贴板限制。
- [x] 报告实际测试数量、iPhone 未测项和下一阶段；保留全部变更供用户查看，无 push / merge / deploy。

## 执行检查

以上任务顺序执行，共享同一数据库与契约，推荐本聊天直接执行。每任务先失败测试再实现；必要的本机端口与浏览器权限使用已有可执行授权流程。避免把之前名称 / 文案改动混入不相关提交。提交如执行，仅暂存明确任务文件；未经要求不发布。

验收记录：见 docs/PREPARATION_PROGRESS.md 与 docs/PREPARATION_TEST_REPORT.md。WebKit / 真机未测已明确报告；所有本轮实施任务完成，未声称后续对局已完成。准备接口最终增加 required settingsRevision 参数，详见审查修复记录。
