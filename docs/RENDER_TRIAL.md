# Render 免费试用部署

更新：2026-10-10（America/Los_Angeles）。本次用户明确选择免费版试用，并确认使用 Render 的 My Workspace。部署现有 app 的单服务版本，Sites 适配暂不实施；这不改变玩法范围。

## 当前服务

- 入口：[笔记狼人杀试用站](https://note-wolf-trial.onrender.com)。
- 管理：[Render 服务控制台](https://dashboard.render.com/web/srv-db5gd37lot8c73esepqg)。
- 服务：`note-wolf-trial` / `srv-db5gd37lot8c73esepqg`，Node Web Service，Free，Oregon，单实例。
- 仓库：`https://github.com/yup005/note_wolf`，分支 `main`。
- 首次部署：`dep-db5gd3nlot8c73eseqo0`，Render 返回 `live`。部署源码：[fab5566d84ec2fb2b3572d105f3e1935a879911a](https://github.com/yup005/note_wolf/commit/fab5566d84ec2fb2b3572d105f3e1935a879911a)。该 SHA 是已上线源码，不是后续部署文档提交。
- 前端、API 和 Socket.IO 由同一个服务提供，不需要跨域会话或迁移规则引擎。

## 可重现配置

| 项目 | 值 |
|---|---|
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Node version | `NODE_VERSION=24.21.0` |
| Production mode | `NODE_ENV=production` |
| HTTPS cookie | `SECURE_COOKIE=1` |
| Disable simulated-player helpers | `WOLF_TEST_PLAYERS=0` |
| Trial database | `WOLF_DB_PATH=/tmp/note-wolf/lobby.db` |
| Auto deploy | Disabled；按已验证的完整交付批次手动部署 |
| Health endpoint | `/api/health`；本次通过外部请求检查，服务控制台未设置自定义健康检查路径 |

Render 提供 `PORT`，现有服务已经监听 `0.0.0.0`。显式安装 devDependencies 是因为生产启动依赖 `tsx`，构建依赖 TypeScript/Vite。没有上传本机 `.data/`、真实玩家数据库或环境密钥，没有设置管理员初始密码；普通游客和账号功能可用，管理员初始化另行使用已有安全流程。

## 免费试用边界

这是功能试用入口，不是已经完成持久化和真机验收的正式 Beta。Free 服务没有持久磁盘；SQLite、账号、房间、复盘和收藏可能在休眠、重启、重新部署时丢失。无入站流量 15 分钟后可休眠，首次唤醒可能约需一分钟。参见 [Render Free](https://render.com/docs/free)。

不要用定时请求绕开休眠，也不新增后台保活任务。上线的只有现行 12 人预女猎白；机械/装甲基础和本机正在开发的配置改动不能误报为可玩。外部只读分享仍遵守作者主动发布、VIP、撤销及隐私校验；本次没有为任何真实对局生成分享链接。

首次发布关闭 auto-deploy，避免未经检查的提交或讨论文档更新重启试用数据库。后续发布应先检查目标提交并运行项目要求的验证，避开正在进行的试用对局，再用 Render 手动部署；新部署需重新核对源码 SHA 和公网流程。当前服务没有自动更新承诺。

## 本次实际验证

在独立临时源码副本中验证已上线 SHA，保留本机另一任务的未提交代码/文档：`npm test` 178 pass / 0 fail / 0 skip，`npm run typecheck` 和 `npm run build` 通过。使用现有本机依赖；Render 另外以锁文件执行干净安装并成功构建。没有更改产品代码/UI，本次未重跑全套本地 E2E。

公网自动检查使用本次新建的人工验证会话：13 个独立游客会话，其中 12 席完成入座、准备、随机发牌、本人身份确认和开局；只统计配比，不输出身份正文。验证 HTTPS、HttpOnly/Secure/SameSite=Strict Cookie、WSS 同步/重连、同会话刷新恢复、公有投影无身份字段、未参局者 HTTP/Socket 越权拒绝、异域请求拒绝、非房主发牌拒绝，以及生产模拟身份读取/代操作接口返回 404。未调用生产测试后门。

浏览器实际打开公网首页，游客创建验证房间并显示「已连接」，返回首页可恢复本设备房间。Render 应用 error 日志查询没有返回错误。验证房间均为人工合成数据，未读取其他玩家房间；无删除接口，未通过数据库删除或重新部署清理它们。

尚未验证：12 部真实手机整局、真实 iPhone Safari、真实语音、锁屏/弱网、自然等待全部计时、公网整局胜负/复盘、容量压力和备份恢复。公网准备/发牌/开局不等于已完成整局验收。BETA-009 仅为试用部署部分实现，BETA-010 仍未完成。

## 后续正式化

正式保留数据前，需选择带持久存储的服务或单独规划数据库迁移，完成 SQLite 一致性备份/恢复演练，再做真实手机整局验收；不因本次免费试用自动授权收费升级或迁移现有玩家数据。
