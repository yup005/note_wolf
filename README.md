# 围坐 · 狼人杀面杀助手

手机优先的线下面杀辅助 Web App。当前完成第一阶段：12 人预女猎白房间大厅、四位房间号、创建/加入/首次选座、多人实时同步及刷新恢复。发牌、自动法官、房主对局控制、复盘属于后续阶段，当前没有开始对局入口。

## 本地运行

需要 Node.js **24 或更新版本**。SQLite 使用 better-sqlite3；若平台没有预编译包，需要本机 C++ 编译工具和 Python。

```bash
cd /workspace/note_wolf
npm ci
npm run dev
```

浏览器打开 http://localhost:3000 。服务绑定 `0.0.0.0`，同一局域网内的手机打开 `http://电脑的局域网IP:3000`。请允许本机防火墙的 3000 端口。不同手机或浏览器的独立用户配置有独立会话；同一浏览器的多个标签页共享同一成员。

此聊天使用的云环境与手机不在同一局域网，云环境 localhost 链接不能直接作为手机可访问地址。将项目放到本机启动后即可按上述方式验证；公网部署另行配置 HTTPS 和 WebSocket 反向代理。

## 构建与验证

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
npm start
```

E2E 使用 Playwright 和已安装的 Chromium。Linux 默认路径 `/usr/bin/chromium`；其他平台通过 `PLAYWRIGHT_CHROMIUM_PATH` 指向 Chromium 可执行文件，例如：

```bash
PLAYWRIGHT_CHROMIUM_PATH=/path/to/chromium npm run test:e2e
```

E2E 启动独立端口 3100 的内存数据库服务；开发数据不受影响。测试输出在 `test-results/`（不纳入 Git）。

## 配置与数据

| 环境变量 | 默认值 | 用途 |
|---|---|---|
| `PORT` | `3000` | HTTP 与实时连接共用端口 |
| `WOLF_DB_PATH` | `.data/lobby.db` | SQLite 文件路径；测试可用 `:memory:` |
| `SECURE_COOKIE` | 未设置 | HTTPS 部署设置为 `1`，启用 Secure 会话 cookie |
| `NODE_ENV` | 未设置 | `production` 使用 `dist/web`；否则使用 Vite 中间件 |

无需外部数据库、账号服务或 API 密钥。数据库保存房间、成员与设备会话哈希，刷新和进程重启保留座位。房间号仅用于寻找房间；设备凭证由服务端签发，通过 HttpOnly、SameSite cookie 传输。删除浏览器 cookie 会失去原设备的成员与房主管理授权；当前不提供跨设备恢复或账号绑定。

`npm start` 使用构建产物运行，需要先 `npm run build`。生产部署应使用 HTTPS、设置 `SECURE_COOKIE=1`，保留同源 `/api` 与 `/socket.io`，支持 WebSocket 升级，并备份 SQLite 文件。当前仅支持单服务实例，不把此阶段等同于生产上线。

## 架构

- `apps/web`：React 中文移动界面、OTP、大厅及实时订阅。
- `apps/server`：HTTP 输入校验、会话、权限与 Socket.IO 广播。
- `packages/contracts`：共享公共投影与请求结构。
- `packages/domain`：已确认板子配置、显式未决规则策略。
- `packages/storage`：SQLite 迁移、唯一约束、事务、设备成员与持久化。
- `tests`：SQLite 领域测试、真实 HTTP/socket 集成测试及浏览器测试。

多个竞争请求由 SQLite `BEGIN IMMEDIATE` 事务串行处理，一张座位只属于一个成员。每次状态更改递增 revision；浏览器丢弃旧快照，重连重新获取完整快照。公共快照不包含设备凭证、真实角色或秘密行动。

## 规则与范围

原始规格和验收材料保存在 `docs/WEREWOLF_RULES_SPEC.md` 与 `docs/WEREWOLF_TEST_CASES.md`。附件中的“实现建议”不作为已确认规则。待裁决内容集中在 [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md)，不实现隐含默认。

当前只允许首次占座，同一座位重复请求幂等；换座/退座、跨设备接管和房间自动清理尚未开放。房主可作为管理成员进入大厅，不自动占座；这不表示已决定后续开局时房主是否必须占座。24 小时清理机制待有效活动边界确认，已结束复盘不在本阶段创建。

阶段设计见 `docs/superpowers/specs/2026-10-09-werewolf-lobby-design.md`，执行计划见 `docs/superpowers/plans/2026-10-09-werewolf-lobby.md`，实际验证结果见 `docs/TEST_REPORT.md`。
