# Mechanical M3–M6 continuation

Date: 2026-10-10. Owner authorizes continuing remaining confirmed work after M0–M2; preserve standard runtime and publish verified stages on current main. [Specification](../../CODEX_MECHANICAL_BOARDS_IMPLEMENTATION.md), [mechanical rules](../../MECHANICAL_WOLF_SEER.md), [armor rules](../../MECHANICAL_ARMOR.md), [progress](../../MECHANICAL_IMPLEMENTATION_PROGRESS.md).

## Architecture and scope

Extend M2 with a reusable confirmed ability profile/learning/inspection layer and explicit per-source resolution strategies. Keep Night/Day/Control/voice/auth/records boundaries. No role-pair settlement branches, no secret host/admin APIs. Until concrete runtime integration and rule decisions pass, keep new-board dealing gated. This avoids exposing an incomplete gameplay path.

## Sequence / independent ownership

1. Fix local development stale-server blank page and seat-label cropping first. Explicit server/package watch paths avoid Vite temporary-config restart loops; add local dev:test command while production test endpoints stay disabled. Run npm test/typecheck/build/full E2E, update progress and publish this fix batch.
2. M3 ability layer: generate confirmed native/copy profiles, learn once from other alive player, immediate mimic, next-night skill timing except hunter, witch poison-only copy, freeze multi-level copies, guard last-target legality, independent inventory, private inspection and shot eligibility after victory. Domain tests first. Changes owned by ability implementer only.
3. M3/M4 resolution layer: implement confirmed ordinary/piercing knife, ordinary/mechanical guard, independent antidote, poison reflection to caster, armor stacked ordinary knives/invincible shield/no reflection. Unknown interactions return product-decision blocked rather than guessing. Changes owned by resolution implementer only.
4. Parent integrates durable engine state, confirmed phase collection/private projection/timeouts with existing runtime after checking interface contracts and missing rules. Add role-specific HTTP/UI only with server ownership/permissions and public-leak tests. Run required full checks and publish completed M3, then M4.
5. M5 mixer/idiot victory and interjection: use the later confirmed mixer timeout/inspection and idiot alive/terminal priority in the ledger; keep other undefined branches blocked. Implement confirmed independent15-second interruption accounting and pause current speaker. Full regressions and milestone publication.
6. M6 isolated browser/integration acceptance: online/physical × automatic/manual, refresh/reconnect/restart/secret projections/replay. Physical iPhone Safari, actual sound/lock/background/weak network and multiplayer remain separate owner/device acceptance; never declare simulated E2E physical acceptance.

## Historical questions asked early (resolved by later confirmations in ledger)

- New-board witch self-save after night one; ordinary guard + antidote overlap and mechanical guard + antidote overlap.
- Idiot/mechanical idiot flipped alive/attackable/victory classification and simultaneous wolf-terminal/extra-night priority.
- Mixer missing model timeout, private selection and exact inspection/mimic result.
- Undefined special damage/custom mechanism chains remain blocked without a confirmed rule. Native standard self-save and all previously playable behavior remain unchanged.

## Ledger

- Preflight: clean main00d1159; fetched origin, ahead0/behind0. Existing local Node process predates M1, while Vite served new UI; browser error at RoomLobby reading missing board.name. Warm restart preserves original database and sessions; auto-watch limited to source directories after default import watcher proved to loop on Vite generated config.
- Owner's new screenshot reproduces seat-name vertical clipping; regression will assert actual rendered text bounds across desktop and narrow phone widths.
- Local test feature remains supported. Root initially restarted without WOLF_TEST_PLAYERS; restored explicit dev:test mode when owner reported missing console.

- Dev fix published ataf7363257ac223edf168b0c4bd56526b3aff1964, verified remote match; fullunit226/fullbrowser36/typecheck/build passed at that boundary. Later owner confirms all-night no-selfsave, all guards+antidote奶穿, mixed-blood private/timeout/exactidentity and idiot classification/dual-only speech restriction. Extra ordinarywolf learning-night question owner says unreachable if wolves alreadydead; complex alternative copy chains remain blocked.
- Owner's compatible steering adds existing admin access verification (local account andcredentialfile verified, no password exposure), nickname/avatar editing (1MB ordinary/2MB activeVIP), automatic24h unprotected-room cleanup including ongoing/paused. These are prioritized bounded feature deliveries before returning to fullM3–M6 runtime. Current mechanical domain/copy/inspection/settlement is an internal partial delivery, not milestone completion. Newboard dealing stays gated.

- 2026-10-11 bounded delivery: own profile and runtime-only24h retention complete, official record evidence preserved before cascades, offline expiry and unpublished-record publication defects RED→GREEN and independently reviewed. Fullunit271/fullbrowser42/typecheck/build passed. InternalM3/M4 profiles/learning/inspection/settlement44 domain tests pass; full runtime/M5/M6 remain pending and new-board dealing gated.
