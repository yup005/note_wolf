# Black and white wolf kings

Owner authorized this next delivery with “继续”, following the agreed order after dual-category idiot. Existing request “都允许 你别问我了” removes repeated design/execution approval prompts. Implement the confirmed scope inline; no deployment, no PR merge, no live-player data.

Authority: [owner items 20, 28–36, 44–45](../../PRODUCT_DECISIONS.md). Preserve standard12, the explicit14 policy and record-only endings. Unknown gameplay is not resolved by this design.

## Runtime design

- Extend the role catalog with `blackWolf` and `whiteWolf`. Both are actual wolves and shared night-knife actors. Only these two additional special roles may repeat. Templates remain unchanged; custom role configuration and locked identities use existing storage.
- Native black-wolf shot is an independent one-charge `shot` instance with a black-wolf damage profile. Knife, exile, gun and white-wolf carry use the confirmed death window; poison and self-explosion do not. A copied black-wolf shot retains this profile and full independent capacity. Ordinary hunter/copied hunter trigger rules stay separate. Victory is checked before any death skill and after each ordered daytime death.
- Native white-wolf ability is an independent one-charge `explode-take` instance. Mechanical/armor copies gain the same capability for the first day after the learning night; unlearned mechanical/armor actors remain unable to explode. Shared knife membership follows true roles, never mimicked roles.
- Preserve the ordinary legal explosion phases and exile-PK candidate prohibition. Self-explosion and already-pending night deaths settle before victory. A terminal verdict clears the remaining public action queue and never executes a carry. Poison-swallowing on sheriff phases cannot carry and never announces the private poison fact.
- A nonterminal eligible white-wolf explosion enters `white_wolf_target`, with the public caster seat as current death and no private source/profile data. The actual player names a physical living target offline; the host/authorized public manager records it using a strict `record_take` command. This mirrors existing public hunter target recording. It is not delegation of secret night skills.
- Carry kills directly using `white-wolf` death evidence; settled night guards, including invincible shields, do not apply. Recheck victory before victim skills; nonterminal victims enter existing ordered death-skill/badge handling. Reuse the established explosion interruption and last-word source policy; do not add new last-word entitlements to carry chains. Explicit future exceptions must remain separate.
- Preserve actor/turn/version authorization, transactional rollback, pause/restart/reconnection and ended-only replay access. Public labels reveal native or mimicked king only when its public skill is used; actual mechanical/armor identity stays hidden until normal end reveal.

## Surfaces and verification

Board editor exposes repeatable king counts. Day panel distinguishes black-wolf gun and white-wolf target recording, with explicit explosion confirmation. Public voice uses public phases and seats only. Manual death records/replay recognize white-wolf carry; archived true roles remain authoritative for outcome and mixed-blood camp. No new administrator secret access.

Regression focus: repeated kings/unique other specials; shared knife inheritance; last-wolf terminal ordering; poison-swallowing and stale/forged commands; independent copied inventory and first-day activation; chained gun/carry; night protection expiration; standard12/dual14/no-wolf invariants; restart/pause/private HTTP and public Socket projections. Finish with full `npm test`, typecheck/build and full Chromium mobile E2E; real iPhone/audio acceptance remains separate.
