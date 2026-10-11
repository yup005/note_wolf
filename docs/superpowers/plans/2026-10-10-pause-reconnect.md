# Pause and Reconnect Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 完成暂停 / 恢复、临时房主与神职重连宽限，保持手机主操作区紧凑。
**Architecture:** 独立 ControlStore 持久化冻结状态、管理授权、连接记录及未来投票默认。NightStore / DayStore 在任何变更前检查冻结状态，秘密动作仍验证本人角色；Socket 仅写服务器验证过的连接事件。
**Tech Stack:** React、TypeScript、Express、Socket.io、SQLite；无新增依赖。
**Spec:** docs/PAUSE_RECONNECT_DESIGN.md

## Global Constraints

- 暂停和恢复二次确认；恢复准备固定 5 秒；冻结当前剩余时间，不能修改核心规则。
- 每人每局一次最多 15 秒宽限，狼人严格 180 秒；公开提示不含身份或座位。
- 临时房主只能管理公开流程；原房主死亡后管理权保留。
- 320×568、390×844、430×932 手机游戏操作不滚动；已有数据库先备份再迁移。

## Review Focus

- 恢复准备时重启服务、继续暂停或重复提交不能重置阶段 / 延长剩余时间。
- 同账号两客户端和两个标签仅最后断开才记离线。
- 迟到技能在暂停中拒绝，恢复后不重复执行已提交技能。
- 临时管理者死亡、撤销权限后不能继续控制，也不能取得他人身份。
- 首次连接、神职已提交、狼人、死者与跨阶段断线记录不能错误获得宽限。

### Task 1: Server control and authorization
- [x] 添加暂停 / 恢复 / 临时授权 / 未来设置合同与失败测试。
- [x] 实现控制持久化、有效阶段冻结、5 秒恢复和全部变更入口守卫。
- [x] 验证暂停所有动作、断线不自动暂停、权限和重启。

### Task 2: Presence and grace
- [x] 添加最后连接离线、一次神职宽限、狼阶段上限和秘密隔离测试。
- [x] 接入 socket 已验证订阅 / 断开统计，持久化连接与宽限。
- [x] 在夜间边界处理宽限并验证服务重启、阶段过期和已提交操作。

### Task 3: Mobile UI and delivery
- [x] 添加紧凑管理入口、统一遮罩、5 秒倒计时及未来投票设置。
- [x] 独立浏览器验证暂停同步、拒绝技能 / 投票、临时管理和恢复。
- [x] 完整回归、构建、代码审查；备份并更新 localhost；报告实测 / 未实测边界。

**Delivered:** 119 server tests, 20 Chrome E2E tests, production build and diff check passed. Local data backed up and migrated with all existing game state preserved. See `docs/PAUSE_RECONNECT_TEST_REPORT.md` for evidence and real-device limitations.
