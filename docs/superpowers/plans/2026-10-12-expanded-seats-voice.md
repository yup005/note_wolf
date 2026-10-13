# Expanded seats and audible public voice

Owner reports 13-seat confirmation, compressed final target card, and real silence in the local test browser. Scope is the current application; no deployment or secret access changes. Continue inline without repeated approvals.

## Evidence and design

- Confirmation is N-1 simulated players until the real host views/confirms their own card; preserve that requirement and clarify the next action.
- Fixed explicit rows left extra rows at content height. Add matching implicit row sizing, preserving standard layouts and checking13–15 night/day at narrow, short and desktop sizes.
- Public speech was initially off, then the actual browser reported playback failure after enabling. Keep the native speech path as an explicit alternative, expose the enable entry, and default to local prerecorded Chinese public cues per the owner’s explicit recording preference. The user selects it with a gesture; unlock Web Audio immediately, then load same-origin static clips. No third-party speech service, credentials, microphone or runtime private text generation.
- Audio vocabulary is generated offline only from existing public voice templates plus Chinese number atoms. Greedy tokenization must reject unknown text. Clip sequences retain every public number/word; cancellation/generation/scope and lease checks remain authoritative. Audio mode persists on this device. Native timeout/error tests retain original assertions; actual sound is distinct from mocked tests.

## Tasks

- [x] Reproduce13–15 equal rows and verify host confirmation; fix grid/confirmation copy/visible enable entry.
- [x] Write tokenization/asset/cancel regressions; generate public static audio and implement gesture-unlocked recorded fallback, preserving lease/privacy/error behavior.
- [x] Verify the actual local browser, full npm test/typecheck/build/full E2E, independent review and docs. 400 unit tests and59 full browser tests passed;77 clips decoded to nonzero PCM. Actual local UI entered recorded playback; human audibility and real iPhone/multi-device acceptance stay pending.
- [ ] Publish the completed verified batch on main and verify remote SHA; record implementation SHA in the existing progress/report documents.

Owner timing addition: mechanical_authority15s only; subsequent eyes_closed5s and guard30s retained. Numeric-list review found separator merging; exact1、3 and13、14 failing regression added, then normalized input/vocabulary equivalently and prerecorded和 preserves individual numbers.
