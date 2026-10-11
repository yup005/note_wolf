# Complete Game Implementation Plan

> **For agentic workers:** Use executing-plans and dispatching-parallel-agents for isolated night-engine work; one final independent review.

**Goal:** Run 12-player automatic games from first night to a winner, with corrected speaking controls and visible development test roles.
**Architecture:** Persistent current night/day snapshots with inherited resources and cross-round transactional transitions. Existing engines stay separate from React pages. Guarded test-only identity endpoint; ended-only replay endpoint.
**Tech Stack:** TypeScript, React, SQLite, Socket.IO, Node test, Playwright.
**Spec:** docs/superpowers/specs/2026-10-10-complete-game-design.md

## Global Constraints
- Preserve current checkout changes; no commit, publish, restart of user game or identity reset.
- Mobile-first white/light gray rounded cards; role gaps 5 seconds, death skills 10, words 90, wolves hard cap 180.
- Host must play but cannot read/control other real identities.
- Unanswered manual-to-auto semantics remain unresolved.

## Review Focus
- Stale phase commands during cross-round transitions cannot mutate previous turns.
- Dead or spent role actions cannot execute; virtual stages cannot reveal role death.
- Replay and test identities never leak through ordinary snapshots, voting or sockets.
- Night resources and deferred election survive refresh/restart without duplicate effects.
- Next-night priority wolf expiry and hunter-once persist across rounds.

### Task 1: Reusable night engine
Files: contracts/night.ts, domain/night.ts, tests/full-night.test.ts.
Interface: createNight(players, now, carry?) with night, alive, antidote, poison, hunterSpent, priorityWolf. Legacy first_night_complete phase retained for compatibility. NightPrivate includes priority wolf choice and confirmation; priority command separate from ordinary wolf vote.
- [x] Write/run failing carry, dead-role, target, priority knife/empty/fallback/180/expiry tests.
- [x] Implement and pass old+new night tests.

### Task 2: Reusable day engine and speaking
Files: contracts/day.ts, domain/day.ts, tests/full-day.test.ts.
Interface: createDay(night, rules, now, previous?) inherits campaign and deaths. Public speechMode/direction/start data, direction command optional start seat; hunterSpent persisted.
- [x] Write/run failing auto-election, speech anchors/free-host, multi-day death/words/skill/election tests.
- [x] Implement and pass old+new day tests.

### Task 3: Storage and UI integration
Files: storage/day.ts, storage/night.ts, storage/lobby.ts, server/app.ts, web DayPanel/NightPanel/RoomLobby, shared useTestRoles.ts.
- [x] Write/run failing cross-round/restart/stale/dead authorization/test-role/replay permissions tests.
- [x] Add transactional phase handoff and ended-only event history; keep repeated requests idempotent.
- [x] Show identities only via guarded dev host endpoint; generalize round titles, anchors and next-night buttons.

### Task 4: Whole-game verification
Files: tests/e2e/day.spec.ts, full-game.spec.ts, docs/COMPLETE_GAME_TEST_REPORT.md, README.md, OPEN_QUESTIONS.md.
- [x] Complete a multi-night game through real routes; exercise priority knife and deferred double explosion.
- [x] Browser simulate phone sizes through repeated nights, free speech, voting and final role/result page.
- [x] Run full tests, browser tests, build, independent review; address findings, report actual device limits.
- [x] Back up SQLite then update live service without resetting room state.

## 验证记录

2026-10-10：79/79 后端测试、12/12 Chrome 浏览器测试、TypeScript 与生产构建通过。独立复查发现赛后访客读取记录权限缺口，已限制到本局参赛者并以 RED→GREEN 回归验证。当前数据库没有旧的未决规则对局。更新前 SQLite 一致性备份，更新后健康检查与两间现有房间进度保留。未进行实际 iPhone / 实体多设备验收。
