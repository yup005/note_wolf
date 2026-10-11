# 可配置板子基础层 Implementation Plan

> 本次在当前分支执行；项目已授权按完整功能批次提交推送。按 test-driven-development 执行，保留用户编辑与未决规则。

**Goal:** 完成 CFG-001 / COPY-001 / WIN-001 共享基础并接入标准板子的通用函数。

**Architecture:** 新契约与现有可玩契约分离；配置、技能和胜利各自独立。现有准备与胜负使用这些基础，新板子的存储/API/UI/完整夜间流程后续接入。

**Tech Stack:** Node.js 24+, TypeScript, Zod, node:test。

**Spec:** [设计](../specs/2026-10-10-board-foundation-design.md)。

## Global Constraints

- 不猜测未决规则，不开放未实现新板子，不改变公共秘密投影。
- 发布前完整 npm test、typecheck、build，记录实际结果；当前页面无改动。

## Review Focus

- 人数与角色总数必须一致，拒绝未知角色和规则版本注入。
- 模板和副本不能共享可变引用。
- 消耗不能改变源能力，已耗尽或尚未生效不能操作。
- 拟态不能改变真实阵营，特殊终局未决不能当普通好人胜利。
- 现有标准板子发牌及自动/手动胜利行为保持兼容。

## Task 1: 配置、复制、胜利基础与现有接入

Files: 新增 `packages/contracts/board.ts`、`packages/domain/boardConfig.ts`、`packages/domain/skills.ts`、`packages/domain/victory.ts` 与 `tests/board-foundation.test.ts`；修改 `packages/domain/preparation.ts`、`day.ts`、`manual.ts`。

Interfaces: `createBoardConfiguration(input)` 返回已校验配置、自动 ruleset 与 playable 标记；`boardPreset(id)` 返回独立配置；`assertPlayableBoard(config)` 阻断未实现配置。`copySkills(source, metadata)` 与 `useSkill(snapshot, skillId, night, target)` 创建和消耗独立技能快照。`evaluateVictory(players, ruleset)` 返回 playing / ended / unresolved。

- [ ] 编写配置、复制、胜利及旧板子兼容测试；执行并确认缺失接口导致失败。
- [ ] 实现契约和领域模块；配置无法绕过可玩范围，消耗和复制均不修改输入。
- [ ] 接入现有发牌数量与自动/手动胜利；执行新增测试和完整回归。
- [ ] 复查 diff 和隐私边界，更新相关需求索引、规则验收、项目进度与 README。
- [ ] 运行要求检查，fetch 检查新需求，按批次 commit/push 并核实远端 SHA。

计划自检：本批只实现设计列出的基础层，输入边界、共享引用、终局分类和未决阻断均有对应测试；未扩展公开契约、数据库或页面。
