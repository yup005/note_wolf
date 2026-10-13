# Mechanical board implementation progress

## 最新补充：狼刀权限确认15秒（2026-10-12）

Owner本地测试直接确认权限确认阶段15秒；仅覆盖原该阶段30秒默认，随后5秒闭眼及其他行动时长保持。13–15席布局与预录公开语音同时修正，详细源/检查及未部署边界见[交接](PROJECT_STATUS_FOR_CHATGPT.md)和[报告](TEST_REPORT.md)。

## 历史批次：黑白狼王及复制能力（2026-10-12）

CFG-05 / CFG-001 / COPY-001 / WIN-001 / FUTURE-006：可重复的原生黑/白狼王、共享刀/真实阵营、胜利优先死亡链、机械/装甲独立复制及首白天/吞毒分支已接入。实际检查与未部署/实机边界统一见[当前交接](PROJECT_STATUS_FOR_CHATGPT.md)和[验证报告](TEST_REPORT.md)；旧目录缺失及技能待实现属于历史阶段，不能覆盖本批。第37项、法官/手动切回和未定义交互仍待开发或阻断。

## 历史：双边白痴与配牌边界（2026-10-12）

FUTURE-007 / CFG-001 / WIN-001：14人真实白痴的独立双边选项、神/民结算、跨夜/转手动/归档已本地接入；无狼仅手动并由房主确认结束、不判胜可发布，纯狼不能正常开局。标准12及机械白痴额外夜保留。最新确认、实际检查结果、审查修复、实施SHA与未部署/实机边界统一见[当前交接](PROJECT_STATUS_FOR_CHATGPT.md)和[验证报告](TEST_REPORT.md)；下方旧日期章节保留为历史证据，不能覆盖本批已实施项。


Date: 2026-10-12 (America/Los_Angeles). Entry point: [M0–M6 specification](CODEX_MECHANICAL_BOARDS_IMPLEMENTATION.md). Confirmation, implementation and executed verification are separate.

## Historical M0 module/test differences

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
| M1 | Complete; published | Three selectable immutable presets, saved owner templates, composition preview/edit, 13/15/zero wolf configs, public room snapshots and dynamic seats. Confirmed runtime now connected; capacity remains1–256 seats. |
| M2 | Complete | Versioned role/ability/copy/action/effect/resolution/victory framework and internal durable store; concrete new-board runtime remains M3–M5. |
| M3 | Confirmed runtime implemented; unresolved interactions blocked | Native/copy profiles, fixed phases/private learning/inspection/guard/witch/hunter UI, settled night evidence and cross-night persistence |
| M4 | Confirmed runtime implemented; unresolved interactions blocked | Armor frozen nested copy, independent inventory, invincible guard/stacked knife, inherited knife and fixed armor stage |
| M5 | Confirmed default runtime implemented; separate dual-category variant pending | Mixer private model/timeout, standard12 mixed-blood exception, extra-night mechanical idiot, independent15s interjection and pause/resume;14-player dual-category policy not selectable |
| M6 | Automated coverage expanded; physical acceptance pending | Dynamic online/physical × automatic/manual, browser private actions/refresh, HTTP/Socket privacy, restart, replay and extra-night scenarios; real devices/multiplayer remain separate |

<a id="product-decision-blockers"></a>

## Historical blockers and remaining implementation (2026-10-11 baseline; 2026-10-12 updates below)

Current blockers are [unified specification §7](CODEX_MECHANICAL_BOARDS_IMPLEMENTATION.md#7-未决项--codex-禁止擅自决定). Confirmed never-self-save, milk-through, mixed-blood timeout/private seat view, default idiot categories and extra-night runtime are implemented. The historical 14-player policy blocker is superseded by the 2026-10-12 delivery below; it remains an explicit choice, not a headcount inference. Armor source inheritance ced569a/fab5566d and extra knife only after inherited normal knife remain authoritative. Complex reflection, undefined damage/copy combinations (including ordinary seer copies), unconfirmed camp inspection of mixed blood and special model/configuration boundaries remain blocked. CFG-05 generic shared-knife membership is domain-supported; black/white wolf king declarations/powers are absent from the runtime role catalog. Existing standard12 stays compatible; owner-authorized3-villager+1-mixed-blood variant uses all4 civilian targets. This is code delivery, not a deployment.

## Current runtime delivery evidence (2026-10-11)

- Confirmed M3–M5 flows now run through existing night/day/control/storage and private player UI; dynamic online/physical × automatic/manual, native spirit-seer exact inspection, armor frozen learning/independent poison and inherited knife are exercised. Three-night actual LobbyStore tests cover final mechanical-idiot exile, restart, ghost private knife, surviving protection and both terminal outcomes.
- `mechanical-server-privacy.test.ts` uses actual synthetic participant HTTP/Socket sessions and restart: private learning/inspection stays local to the actor; hosts, outsiders and spoofed requests cannot read it; test helpers are disabled in production. Ongoing mixer cards expose only the model seat. Replay includes native/copy results and confirmation/priority-knife events only after the existing end authorization.
- Manual missing learning/model or unrecorded extra-night facts remain uncertain. Existing owner-confirmed host adjudication is now an explicit version-checked endpoint and confirmation UI; audits, publication, cleanup/restart and sharing retain the `host-adjudicated` source. Standard/computable results cannot be overridden. Regression includes unchanged official drafts and auto-to-manual pending bonus night.
- Review findings addressed with regressions: standard12 mixed-blood threshold, mixer camp leakage, guarded/reflected hunter poison state, idempotent private receipts and turn-scoped acknowledgement, missing replay events, pending manual bonus-night premature victory and share provenance. Independent review covered migrations and runtime; final manual-sharing follow-up was completed by the implementer after reviewer execution became unavailable.
- Final full unit **320 pass /0 fail /0 skip**; typecheck/build pass; full Chromium mobile E2E **44 pass /0 fail /0 skip（1.6m）**. Browser actions/save/refresh/adjudicate/publish and320/390/430px layouts use synthetic data. Physical iPhone/actual sound/background/weak network/real multiplayer remain unverified; M6 stays partially verified. No deployment; Render auto-deploy is off.

实施提交：[dc8de15a4ffb707e540d329315736eb6def44bf2](https://github.com/yup005/note_wolf/commit/dc8de15a4ffb707e540d329315736eb6def44bf2)。本次SHA跟进仅文档，复核引用与差异，代码检查未重复运行；正常推送后另核对最终远程SHA。

The following M0/M1/M2/internal-increment evidence is historical, preserving the exact verification and feature gates at each earlier delivery. Current scope is governed by the milestones and blockers above.

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
