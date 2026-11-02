# Masquerade Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans; Owner approved the design and requested implementation.

**Goal:** Deliver Issue #14 MASQ-001–044 end to end.
**Architecture:** Dedicated night collection/resolution, existing trusted engine and SQLite transactions, existing public/private projections.
**Tech Stack:** TypeScript, React 19, Zod, SQLite, node:test, Playwright, Node 24.
**Spec:** ../specs/2026-11-01-masquerade-design.md

## Global Constraints

- Official fixed 12-person roster, same-roster custom copies only; preserve old boards and archives.
- First night wolves→witch→seer; later dancer 60s→mask shared 60s→wolves 180s→seer 30s→witch 30s, 5s eyes closed.
- MASQ-044 overrides random timeout; shared deadline, server revisions, idempotent requests.
- Secrets only to actor or explicitly authorized current judge; public deaths by seat only.
- Whole batch resolution and wolves-first simultaneous victory; terminal night skips election.
- No merge, deployment or claim of physical iPhone acceptance.

## Review Focus

- Requests at/after deadline cannot alter stored draft or roll back timeout settlement.
- Private result caches/retries cannot leak previous night or previous game information.
- Histories survive day/night and restart, but never a rematch.
- Manual/judge supplementation never randomly invents past facts.
- Virtual stages preserve public schedule for dead or penalized actors.

### Task 1: Board foundation
Files: contracts/board.ts; domain/boardConfig.ts; storage/boards.ts; tests/masquerade-board.test.ts.
- [x] RED: preset contains correct roles; mask is wolf but not shared; mixed composition blocks start.
- [x] GREEN: add dancer/mask, masquerade, official preset and labels; preserve global version.
- [x] Verify: node --import tsx --test tests/masquerade-board.test.ts.

### Task 2: Trusted history, night collection and resolution
Files: contracts/{masquerade,night,engine,abilities}.ts; domain/{masqueradeNight,masqueradeResolution,night,engine,victory,mechanicalAbilities}.ts; tests/masquerade-night.test.ts.
Produces: initialize/begin/advance/command/privateMasqueradeNight adapters matching existing night entry points; internal engine.masquerade history; NightState.masquerade runtime.
- [x] RED: fixed stage timing; dancer validity/timeout/repeat; mask shared time/draft revisions/repeat; independent histories; inherited knife; poison/dance immunity and multiple causes; serialization.
- [x] GREEN: commands with requestId and expectedRevision; transactional timeout adapters; dedicated damage effects, strict state validation and settlement.
- [x] Verify focused domain tests and typecheck.

### Task 3: Day, recovery, archives, judge
Files: domain/{day,judge,replay,voice}.ts; contracts/{records,day}.ts; storage/{night,control,records,judge}.ts; tests/masquerade-{day,server,replay}.test.ts.
Consumes engine.masquerade and settled effects from Task 2.
- [x] RED: terminal nights bypass elections; living masks cannot explode; public death privacy; restart, HTTP/Socket authorization and stale game requests; judge facts; rematch reset.
- [x] GREEN: explicit night causes; ordered terminal announcement, actor result cutoff, logical clocks, strict judge supplementation and replay.
- [x] Verify focused integration tests.

### Task 4: Mobile operations and reference
Files: web/src/{NightPanel,MasqueradeActions,BoardConfigurationPanel,JudgePanel}.tsx; domain/ruleReference.ts; tests/e2e/masquerade.spec.ts.
Consumes NightPrivate.masquerade and new commands.
- [x] RED: mobile 3-seat selection, repeated target stays clickable, saved drafts recover, mask receipt then mask step without time reset, inherited knife; no private result after day/background/game change.
- [x] GREEN: actor-scoped private component with serial draft writes; judge controls; public labels/voice; rules reference.
- [x] Verify focused E2E and existing board regressions.

### Task 5: Verification and delivery
- [x] Run npm test, npm run typecheck, npm run build, full applicable E2E.
- [x] Update rules, acceptance, decisions, requirement matrix and progress with actual evidence.
- [x] Independent branch review, fix important findings with failing regression first.
- [x] Scoped diff/secret review; commit and push current work branch under standing authorization; verify remote SHA. If publication blocked, retain local changes and report exact blocker.

## Execution evidence

719 unit tests pass; typecheck/build pass. Full161 browser run:160 passed, one foreground bootstrap429; real Retry-After handling corrected in synthetic test fixture, affected10/10 and controlled recovery2/2 passed. Independent review findings resolved with regressions. Main headcount-review docs merged; feature isolated from remote work treasure changes on codex/masquerade-14. Publication is recorded in final remote SHA/PR result; no merge/deployment.
