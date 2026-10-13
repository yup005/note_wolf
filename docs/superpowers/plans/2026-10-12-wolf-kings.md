# Wolf kings implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. Tasks follow TDD. Owner requested continuous execution without repeated approval prompts; publish only the completed verified delivery batch.

**Goal:** Run the confirmed native and copied black/white wolf king abilities through the existing application.

**Architecture:** Extend existing role/skill contracts and shared-knife membership. Add one persisted public daytime target phase, preserving ordered victory and the existing death queue. Do not introduce a second game engine.

**Tech Stack:** TypeScript, React19, Express5/Socket.IO, SQLite, Node24+, existing Playwright Chrome.

**Spec:** [wolf-kings-design](../specs/2026-10-12-wolf-kings-design.md).

## Global constraints

- Preserve standard12, explicit dual14, record-only endings, private identities and the current main checkout.
- No deployment, forced history changes, new dependencies or live data. Unknown gameplay stays blocked.
- Only black/white kings may newly repeat; mechanical/armor/witch/etc remain unique.
- Native/copy capabilities and true role classification remain separate; public management never reads private skill sources.

## Review focus

- Pending poison plus explosion must suppress carry without disclosing the poison source.
- Last actual wolf ends before its gun/carry; a wolf king in the shared knife group prevents premature mechanical inheritance.
- More than one king has independent inventories; another actor cannot consume a dead actor's skill.
- Copied white king activates on the first post-learning day, while night commands cannot invoke daytime skills.
- Persisted target phases/revisions cannot execute twice, survive restart/pause, and keep unfinished secrets out of replay or records.

### Task 1: Role and capability foundation

**Files:** contracts board/abilities; domain boardConfig/victory/mechanicalAbilities/mechanicalEngine/engine/mechanicalNight/manual/night; record-only wolf classification; tests/wolf-kings.test.ts.

**Interfaces:** `blackWolf`, `whiteWolf`; `explode-take`; shared-role predicate exported from board contracts; black shot uses `damage: black-wolf-shot`; first-day copy activation. Consumers use the same actual-role predicate for knife groups and record-only gates.

- [x] Write and run failing composition, camp, copy, inventory, night-use and knife-inheritance tests.
- [x] Implement the catalog, repeatability, actual camp/group and strict copy profile/activation checks.
- [x] Run focused tests and typecheck; retain baseline scopes. Save a local checkpoint only if independently green; do not push intermediate work.

### Task 2: Daytime skills and ordered deaths

**Files:** contracts day/records; domain day/mechanicalAbilities/replay/voice; storage day/control/records; tests/wolf-kings.test.ts and tests/wolf-kings-runtime.test.ts.

**Interfaces:** `white_wolf_target`, strict host/public `record_take`, `white-wolf` death cause; existing `shot` window distinguishes its profile. King explosion legality is identical in command and private projection.

- [x] Write/run failing trigger matrices, last-wolf terminal, copy first-day, swallow poison, protected carry and chain tests.
- [x] Add victory-first explosion/carry and black-shot eligibility without changing hunter rules. Persist phase/queue through existing stores and reject night invocation of daytime skills.
- [x] Verify direct runtime, restart/pause/stale and real HTTP/Socket privacy; keep replay/records ended-only and include public skill evidence.

### Task 3: UI and complete delivery

**Files:** BoardConfigurationPanel/DayPanel/NightPanel and public voice as needed; browser king tests; relevant rules/requirements/progress/readme docs.

- [x] Write/run failing browser repeatable configuration and public black gun/white carry flows.
- [x] Add minimal English-code/Chinese-UI controls with mobile layout and existing confirmations; review React hooks/accessibility.
- [x] Run full npm test, typecheck, build, and full E2E; inspect synthetic screenshots and use one fresh read-only code reviewer.
- [x] Fix concrete review findings with failing regressions; update rules, IDs and honest verification/remaining scope.
- [x] Review scoped docs/diff, commit the completed batch plus implementation-SHA follow-up, fetch, non-force push main and verify remote SHA.
