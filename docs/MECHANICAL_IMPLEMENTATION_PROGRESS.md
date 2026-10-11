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
| M1 | Complete; publication at this boundary | Three selectable immutable presets, saved owner templates, composition preview/edit, 13/15/zero wolf configs, public room snapshots and dynamic seats. New gameplay gate remains until M3–M5. |
| M2 | In progress | Copy/victory foundation exists; event/resolution model and durability missing |
| M3 | Pending | Learning, spiritual seer, guard/poison/shot/knife and private runtime not connected |
| M4 | Pending / blocked branches | Armor activation timing/identity/guard limits unresolved |
| M5 | Pending / blocked branches | Idiot state/victory priority and mixer private selection details unresolved |
| M6 | Pending | Automation and physical acceptance must be reported separately |

## Product decision blockers

All unresolved items from unified specification §7 and the two detailed rule documents are **blocked-by-product-decision** for dependent gameplay, not blanket blockers for M1/M2. Armor simultaneous victory is contradictory between unified §4 and the detailed armor implementation boundary; no assumed priority. Armor extra knife only after inherited normal knife and targets may match/differ is already owner-confirmed in this chat. New-board witch self-save after night one is undecided; standard board continues rejecting all self-save. Mechanical idiot flip/extra-night public behavior is confirmed but alive/victory categorization still requires a decision. Template storage does not resolve no-wolf/no-god-and-civilian validity or add undefined king skills.

## Foundation implementation provenance

Existing shared domain foundation tip: [`3d9d3b7196f287349a0599320e75592ff6d93848`](https://github.com/yup005/note_wolf/commit/3d9d3b7196f287349a0599320e75592ff6d93848), including earlier d7b5aba implementation. Published with M0 at [`e39dacf42489102384ee501621afc93df2cf65ae`](https://github.com/yup005/note_wolf/commit/e39dacf42489102384ee501621afc93df2cf65ae); push and remote SHA verified. Fresh requirements source: 5bba4d1, merged normally at 4874f83. Stage plan: [M0–M2 execution plan](superpowers/plans/2026-10-10-mechanical-m0-m2.md).

## M1 delivery evidence

- CFG-001 / CFG-01–05: fixed standard/mechanical/armor presets, derive/edit/another save/load, strict server/client counts and special-role uniqueness, zero ordinary wolves, ruleset derivation and explicit rule version. Library is guest/account-owned; login links guest saves. Saved-template edits do not change existing room snapshots; standard snapshots are also physically stored and old rooms backfilled.
- Room configuration is host-only before dealing, optimistic settings revision, valid changes reset readiness, shrinking occupied seats rejects atomically. Dynamic lobby seats support13/15; SQLite migration preserves IDs/cards/ready flags and verifies foreign keys. Current service input capability is1–256 seats (technical bound, not a new gameplay rule); legacy game records/commands stay standard12 until gameplay integration.
- New boards may be configured/saved, but full dealing/night/day is not available. Server rejects unfinished boards; test-player filling remains standard-only. Shared wolf-group semantics are domain-tested, not new king skills or runtime roles.
- Independent review P2 test-player readiness regression fixed with failing then passing test. Existing auth E2E caught the legacy standard selector value; product restored its prior value without weakening the test. Targeted browser5/5 and storage5/5 pass; final npm test **184 pass / 0 fail / 0 skip**, typecheck/build pass, full E2E **35 pass / 0 fail / 0 skip**. Independent followup review confirms the fix and default-snapshot backfill; no remaining findings. Scoped75 links/anchors and diff checked; later additions are references to existing files. Physical devices remain unverified.

M1 implementation: [`b5954febee60c8fe88e361545bbd5d81f3a22fc7`](https://github.com/yup005/note_wolf/commit/b5954febee60c8fe88e361545bbd5d81f3a22fc7). SHA followup is documentation-only; code checks were not repeated because no code changed. Publication pending the normal push/remote check at this boundary.
