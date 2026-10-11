# Mechanical board implementation progress

Date: 2026-10-11 (America/Los_Angeles). Entry point: [M0–M6 specification](CODEX_MECHANICAL_BOARDS_IMPLEMENTATION.md). Confirmation, implementation and executed verification are separate.

## M0 module/test differences

| Module | Existing, verified baseline | Missing / next milestone |
|---|---|---|
| Lobby/preparation | Rooms, seats, readiness, online/physical × automatic/manual, private identity lock, restart | Public dynamic board snapshot, owner-saved configs, selector/editor and seat migration (M1) |
| Board domain | Immutable returned templates standard12/mechanical12/armor12 and 13/15 examples; validated custom composition, unique special roles, zero wolves; armor selection | Configuration storage/room selection; new boards still cannot deal |
| Role/copy domain | True role distinct from mimicked role, independent full-capacity snapshot, provenance, timing, idempotent consumption | Rich event/effect/protection evidence and durable engine snapshots (M2); role-specific skill generation (M3/M4) |
| Night/day | Complete standard-board night/day, sheriff, votes, suicide, death chains, automatic/manual win | New roles/private UI, fixed phases, learning, attacks/protection/reflect and special extra night (M3–M5) |
| Victory domain | Standard runtime consumes shared strategy; mechanical/armor true camp, empty-set guards, mixer model and special civilian threshold | Mechanical idiot final-night state machine; new runtime integration (armor ordinary simultaneous priority resolved by later confirmed inheritance) |
| Auth/control/records/voice | Session takeover, pause/resume, reconnect, private drafts, VIP/replay/share permissions, public-only voice | Extend new runtime via existing boundaries; no rewrite required |
| Device acceptance | Chromium mobile regressions available | Physical iPhone, real sound, background/weak network and multiplayer (M6) |

## Milestones

| Milestone | Status | Evidence / limits |
|---|---|---|
| M0 | Complete | Fresh npm test 178 pass / 0 fail / 0 skip, typecheck/build pass; full Chromium mobile E2E 34 pass / 0 fail / 0 skip. Physical-device acceptance remains pending. |
| M1 | Complete; published | Three selectable immutable presets, saved owner templates, composition preview/edit, 13/15/zero wolf configs, public room snapshots and dynamic seats. New gameplay gate remains until M3–M5. |
| M2 | Complete | Versioned role/ability/copy/action/effect/resolution/victory framework and internal durable store; concrete new-board runtime remains M3–M5. |
| M3 | Partial internal domain delivery; runtime pending | Native/copy profiles, learning, frozen inspection and confirmed settlement; fixed phases/private runtime still not connected |
| M4 | Partial domain; runtime pending | Armor frozen nested copy, invincible guard/stacked knife algorithms; unresolved branches explicitly blocked |
| M5 | Confirmed decisions recorded; implementation pending | Mixed-blood timeout/private feedback, idiot classification and dual-variant speech confirmed; state machine/UI not connected |
| M6 | Pending | Automation and physical acceptance must be reported separately |

## Product decision blockers

Current blockers are [unified specification §7](CODEX_MECHANICAL_BOARDS_IMPLEMENTATION.md#7-未决项--codex-禁止擅自决定). Later explicit owner confirmations resolve never-self-save, milk-through for ordinary/mechanical/armor guards, mixed-blood exact inspection/privacy/random timeout, and idiot categories/dual-only speech restriction. They are implementation work, not unresolved decisions. Armor source inheritance ced569a/fab5566d and extra knife only after inherited normal knife remain authoritative. Complex reflection, undefined damage/copy combinations and unconfirmed camp inspection/custom configuration boundaries remain blocked. Existing standard12 stays unchanged; owner-authorized3-villager+1-mixed-blood variant is confirmed but not yet playable.

## Foundation implementation provenance

Existing shared domain foundation tip: [`3d9d3b7196f287349a0599320e75592ff6d93848`](https://github.com/yup005/note_wolf/commit/3d9d3b7196f287349a0599320e75592ff6d93848), including earlier d7b5aba implementation. Published with M0 at [`e39dacf42489102384ee501621afc93df2cf65ae`](https://github.com/yup005/note_wolf/commit/e39dacf42489102384ee501621afc93df2cf65ae); push and remote SHA verified. Fresh requirements source: 5bba4d1, merged normally at 4874f83. Stage plan: [M0–M2 execution plan](superpowers/plans/2026-10-10-mechanical-m0-m2.md).

## M1 delivery evidence

- CFG-001 / CFG-01–05: fixed standard/mechanical/armor presets, derive/edit/another save/load, strict server/client counts and special-role uniqueness, zero ordinary wolves, ruleset derivation and explicit rule version. Library is guest/account-owned; login links guest saves. Saved-template edits do not change existing room snapshots; standard snapshots are also physically stored and old rooms backfilled.
- Room configuration is host-only before dealing, optimistic settings revision, valid changes reset readiness, shrinking occupied seats rejects atomically. Dynamic lobby seats support13/15; SQLite migration preserves IDs/cards/ready flags and verifies foreign keys. Current service input capability is1–256 seats (technical bound, not a new gameplay rule); legacy game records/commands stay standard12 until gameplay integration.
- New boards may be configured/saved, but full dealing/night/day is not available. Server rejects unfinished boards; test-player filling remains standard-only. Shared wolf-group semantics are domain-tested, not new king skills or runtime roles.
- Independent review P2 test-player readiness regression fixed with failing then passing test. Existing auth E2E caught the legacy standard selector value; product restored its prior value without weakening the test. Targeted browser5/5 and storage5/5 pass; final npm test **184 pass / 0 fail / 0 skip**, typecheck/build pass, full E2E **35 pass / 0 fail / 0 skip**. Independent followup review confirms the fix and default-snapshot backfill; no remaining findings. Scoped75 links/anchors and diff checked; later additions are references to existing files. Physical devices remain unverified.

M1 implementation: [`b5954febee60c8fe88e361545bbd5d81f3a22fc7`](https://github.com/yup005/note_wolf/commit/b5954febee60c8fe88e361545bbd5d81f3a22fc7). SHA followup is documentation-only; code checks were not repeated because no code changed. Published and remote SHA verified at5a187d1d8f97528248bf8ec3ad9ef7c04ca0987a.

## M2 delivery evidence

- COPY-001 / CPY-03: shared ability contract, nested JSON parameter snapshots, true role/camp separate from mimic, learning source/time, independent full charges, availability/lastTarget and use history. Source copies persist even after night-end death. Role-specific profiles, phase limits and private player routes remain M3–M5.
- WIN-001: strict versioned internal player/action/effect/resolution/victory contracts and explicit ruleset strategy interface. Collection never marks deaths; independent source outcomes deduplicate deaths before victory. Missing implementation or unresolved product decision returns blocked; synthetic strategies do not claim real DMG-01–07 protection algorithms.
- Durable SQLite store restores learning, independent inventory, actions and settled evidence across restart; rejects stale writes, malformed/versioned/config/camp/provenance/inventory/death/verdict/revision inconsistencies and overflow. SEC-01 synthetic persisted secrets are absent from host/player HTTP and socket subscription/broadcast; no engine HTTP/admin access exists. Existing standard runtime retained.
- Review found three P2 persistence validation gaps; each reproduced RED then fixed. Followup caught null provenance/removal bypass, also RED→GREEN fixed. Independent final review32 pass /0 fail, no remaining findings in M2 scope. Early integration failures were strict knife projection and optional timestamp handling, corrected without relaxing schemas.
- Latest GitHub fetched during M2: main/remote c11846d includes separate Render deployment documentation; source and evidence preserved. This task does not redeploy that service. Confirmed source ced569a / fab5566d overrides obsolete armor unresolved summaries; remaining mixer/idiot/custom damage and new-board witch questions stay blocked.

Architecture and limits: [M2 framework design](superpowers/specs/2026-10-10-engine-framework-design.md). Final npm test **195 pass / 0 fail / 0 skip**, typecheck/build pass; full Chromium mobile E2E **35 pass / 0 fail / 0 skip** (1.4m). This includes11 new M2 tests;32 targeted foundation/engine/store tests also passed. Scoped121 local documentation links/anchors and diff reviewed; confirmed rule/source history retained. Implementation SHA: [8707b0da9d508e5728003f72fca513d5ff181d49](https://github.com/yup005/note_wolf/commit/8707b0da9d508e5728003f72fca513d5ff181d49). This SHA record is documentation-only; code checks were not rerun because executable code did not change. Publication uses normal push and final remote SHA verification at this delivery boundary. Physical iPhone Safari, real sound/background/weak network and full multiplayer new boards remain unverified.


## M3/M4 internal increment (2026-10-11; milestones remain incomplete)

- Confirmed native/copy ability profiles, full independent inventory, guard target rules, once-only learning from another living player, next-night availability (hunter immediate), immutable nested armor copies and private exact inspection. Idiot copying has no fabricated night action; special flip state remains M5.
- Concrete per-source ordinary/piercing/stacked attacks, ordinary/mechanical guard, independent antidote, all confirmed奶穿, poison reflection to caster and armor invincible shield. Death evidence deduplicates victims; undefined complex reflection, camp inspection and damage/copy branches explicitly block.
- Canonical source/camp/knife validation, frozen inspection and versioned persistence reject spoofed inventory/actions. No public host/admin role-read route added. 44 new domain tests (15 ability /10 engine /19 resolution), extended persisted-secret public HTTP/Socket regression.
- Owner steering delivered profile and runtime retention first; this boundary publishes the tested internal increment for review. Fixed night phases, authorized private player routes/UI, integration with existing night/day/control/voice/replay, M5 mixed-blood/idiot/interjection and M6 complete new-board runs remain pending. Standard12 behavior remains intact; new boards cannot deal.
- Full final source checks: npm test271 pass /0 fail /0 skip, typecheck/build pass, full Chromium mobile E2E42 pass /0 fail /0 skip. Independent scope review found no concrete domain/privacy defect. Browser automation does not establish physical iPhone acceptance. Implementation SHA in batch follow-up.

内部增量实现：[5a95561bce2db24f5da46db51faf3c4d8ee7309e](https://github.com/yup005/note_wolf/commit/5a95561bce2db24f5da46db51faf3c4d8ee7309e)。文档跟进仅验证引用/差异；不重复代码测试。
