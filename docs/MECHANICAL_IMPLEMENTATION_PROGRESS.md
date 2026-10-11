# Mechanical board implementation progress

Date: 2026-10-10 (America/Los_Angeles). Entry point: [M0–M6 specification](CODEX_MECHANICAL_BOARDS_IMPLEMENTATION.md). Confirmation, implementation and executed verification are separate.

## M0 module/test differences

| Module | Existing, verified baseline | Missing / next milestone |
|---|---|---|
| Lobby/preparation | Rooms, seats, readiness, online/physical × automatic/manual, private identity lock, restart | Public dynamic board snapshot, owner-saved configs, selector/editor and seat migration (M1) |
| Board domain | Immutable returned templates standard12/mechanical12/armor12 and 13/15 examples; validated custom composition, unique special roles, zero wolves; armor selection | Configuration storage/room selection; new boards still cannot deal |
| Role/copy domain | True role distinct from mimicked role, independent full-capacity snapshot, provenance, timing, idempotent consumption | Rich event/effect/protection evidence and durable engine snapshots (M2); role-specific skill generation (M3/M4) |
| Night/day | Complete standard-board night/day, sheriff, votes, suicide, death chains, automatic/manual win | New roles/private UI, fixed phases, learning, attacks/protection/reflect and special extra night (M3–M5) |
| Victory domain | Standard runtime consumes shared strategy; mechanical/armor true camp, empty-set guards, mixer model and special civilian threshold | Mechanical idiot final-night state machine; armor simultaneous conflict; new runtime integration |
| Auth/control/records/voice | Session takeover, pause/resume, reconnect, private drafts, VIP/replay/share permissions, public-only voice | Extend new runtime via existing boundaries; no rewrite required |
| Device acceptance | Chromium mobile regressions available | Physical iPhone, real sound, background/weak network and multiplayer (M6) |

## Milestones

| Milestone | Status | Evidence / limits |
|---|---|---|
| M0 | Complete | Fresh npm test 178 pass / 0 fail / 0 skip, typecheck/build pass; full Chromium mobile E2E 34 pass / 0 fail / 0 skip. Physical-device acceptance remains pending. |
| M1 | In progress | Domain structure exists; storage/API/UI missing at this baseline |
| M2 | In progress | Copy/victory foundation exists; event/resolution model and durability missing |
| M3 | Pending | Learning, spiritual seer, guard/poison/shot/knife and private runtime not connected |
| M4 | Pending / blocked branches | Armor activation timing/identity/guard limits unresolved |
| M5 | Pending / blocked branches | Idiot state/victory priority and mixer private selection details unresolved |
| M6 | Pending | Automation and physical acceptance must be reported separately |

## Product decision blockers

All unresolved items from unified specification §7 and the two detailed rule documents are **blocked-by-product-decision** for dependent gameplay, not blanket blockers for M1/M2. Armor simultaneous victory is contradictory between unified §4 and the detailed armor implementation boundary; no assumed priority. Armor extra knife only after inherited normal knife and targets may match/differ is already owner-confirmed in this chat. New-board witch self-save after night one is undecided; standard board continues rejecting all self-save. Mechanical idiot flip/extra-night public behavior is confirmed but alive/victory categorization still requires a decision. Template storage does not resolve no-wolf/no-god-and-civilian validity or add undefined king skills.

## Foundation implementation provenance

Existing shared domain foundation tip: [`3d9d3b7196f287349a0599320e75592ff6d93848`](https://github.com/yup005/note_wolf/commit/3d9d3b7196f287349a0599320e75592ff6d93848), including earlier d7b5aba implementation. Publication pending verification. Fresh requirements source: 5bba4d1, merged normally at 4874f83. Stage plan: [M0–M2 execution plan](superpowers/plans/2026-10-10-mechanical-m0-m2.md).
