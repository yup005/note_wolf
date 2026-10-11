# 公共语音实施计划

> 执行：superpowers:executing-plans，在当前已授权的工作树内完成；不自动提交或启动实现子代理。

**Goal:** 一台管理设备播报当前公开阶段，避免秘密外泄、重复播报和过期队列。
**Architecture:** 公共状态纯投影 → SQLite 单设备租约及派发去重 → React 上下文与设备 Web Speech。
**Spec:** docs/superpowers/specs/2026-10-10-public-voice-design.md

## 约束与审查重点

- 仅使用公开 RoomSnapshot；已死亡神职不省略；技能询问统一10秒规则不变。
- 浏览器语音回调不推进游戏，不延长倒计时。普通玩家和后台无秘密或管理权限扩展。
- 多标签竞争、登录接管、临时管理撤销、隐藏 / 断线、过期响应、同阶段重连、不可用语音均测试。

## 步骤

- [x] tests/voice.test.ts：先失败复现。新增 packages/contracts/voice.ts 与 packages/domain/voice.ts 白名单投影；测试秘密字段变化不影响文案、夜昼选择、统一询问、判胜和狼30秒。
- [x] tests/voice-server.test.ts：独立会话 / 标签竞争及登录撤销。packages/storage/voice.ts 存储租约、观察和派发键，LobbyStore 接口、apps/server/app.ts 严格 POST /voice。
- [x] tests/e2e/voice.spec.ts：替换仅音频系统边界记录实际 utterance，请求与公开快照仍真实。PublicVoice.tsx 上下文、GameControls 控件、App 持续挂载；测试虚拟夜序、刷新去重、后台取消与投票 / 胜负、安全失败。
- [x] 全套 npm test、build、E2E，检查320/390/430宽度。一次独立审查，记录真实音频 / iPhone 未测；备份迁移、重启本地服务。

交付证据：docs/PUBLIC_VOICE_TEST_REPORT.md。最终149项服务端、31项浏览器测试通过；生产构建通过。独立审查的5项边界问题已失败复现并修复。schema13迁移保持所有既有表内容一致，本地及LAN健康检查通过。实际音频与iPhone验收仍待进行。
