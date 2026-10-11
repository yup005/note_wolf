# VIP 复盘分享实施计划

> 执行：superpowers:executing-plans；按用户直接执行授权在当前工作树实现，不提交或发布。仅末尾一个独立只读审查。

**Goal:** 可撤销、可跟随最新已发布复盘且受实时VIP资格控制的匿名只读链接。
**Architecture:** 档案已发布投影 → SQLite随机链接 / 修订 → 严格HTTP → 作者控件 / 独立手机阅读页。
**Spec:** docs/superpowers/specs/2026-10-10-record-sharing-design.md

## 约束和审查重点

- 不分享未发布内容或进行中身份，不授权超管创建他人链接，不在Socket广播token。
- VIP到期与主动撤销不同；旧请求不能覆盖新地址或撤销状态。
- 删除房间不删除已发布分享；旧设备会话失效不影响链接但不能再管理。
- 生成仅作者已发布版本，外部响应没有历史索引 / owner / participants / 原始事件。
- URL从当前浏览器origin生成，地址太长要换行；剪贴板不可用允许手动复制，不假报成功。

## 任务

- [x] 数据与权限：tests/sharing.test.ts失败复现；新增contracts/sharing.ts、storage/sharing.ts。接口status(token,recordId)、command(token,recordId,command)、read(linkToken)。修订检查、资格实时校验、只读已发布投影；LobbyStore接线及RecordPost.shareAccess。
- [x] HTTP：tests/sharing-server.test.ts先失败，匿名/public与会话/private路径接线；严格schema、拒绝query、跨来源及旧会话；无正文/秘密管理信息外泄。
- [x] 手机：tests/e2e/sharing.spec.ts先失败；ShareControls与SharedRecordPage，RecordPostDialog与App入口。真实服务 + 独立浏览器验证最新版本、未发布隔离、撤回、撤销、重生成和窄屏。维持主游戏布局。
- [x] 收尾：全套npm test/build/E2E，一次独立审查；备份并副本迁移验证、更新本地服务、健康检查、README / OPEN_QUESTIONS / 测试报告与截图。真实音频/iPhone未测继续保留。

验收记录：156 项服务端、34 项完整手机视口 E2E 与 build 通过。独立审查 P2 已修复并新增撤回 / 无收藏 / 删除房间管理回归；schema14 副本与实际库迁移均保留原有表数据。本地 / LAN 服务健康，真实 iPhone 与公网仍未测。详细见 docs/SHARING_TEST_REPORT.md。
