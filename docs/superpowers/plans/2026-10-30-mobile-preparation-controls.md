# Mobile Preparation Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace three error-prone preparation dropdowns with explicit touch-friendly choices and clarify wolf-girl teammate exclusions.

**Architecture:** Keep current server mutations and settings revision semantics. Add a focused public-board picker dialog and local-draft radio-card component, with one scoped stylesheet. Extend only the girl's authorized private projection for teammate labels.

**Tech Stack:** Existing React/TypeScript/CSS, Node24, Playwright; no new dependencies.

**Spec:** [design](../specs/2026-10-30-mobile-preparation-controls-design.md). Owner explicitly chose direct execution without further design confirmation; native execution in the existing cloud workspace on ui/mobile-preparation-controls.

## Global Constraints

- Controls at least48px; setting text at least16px; 320/390/430px no horizontal overflow.
- No mutation for open/preview/cancel/no-op; existing server permissions and readiness-reset rules unchanged.
- Stale revisions/disconnection/context replacement discard previews; test-room physical dealing stays disabled.
- No individual identities in public board picker; confession wolves only in girl's own current private response.
- Preserve 182 stable requirement IDs and 49 historical confirmations; deployment follows Owner’s explicit later merge/deploy instruction after verification.

## Review Focus

- Delayed room updates and a settings request in flight must not retain a stale apply control.
- Current unsaved compositions and long custom names must remain displayable and cancellable.
- Keyboard focus must stay inside the board dialog and return on close; Escape must never apply.
- Other players, background pages and actor changes must never retain girl-only teammate labels.
- Existing physical/manual combinations and custom-board save flows must still work after replacing selects.

### Task 1: Clarify private confession exclusions

**Files:** Modify packages/domain/wolfGirlNight.ts, apps/web/src/NightPanel.tsx, tests/wolf-girl-night.test.ts and tests/e2e/wolf-girl.spec.ts.

**Interfaces:** Reuse NightPrivate.wolves:number[] only for kind=confession; keep legalTargets. NightPanel derives labels only from its current visible private card.

- [x] Add assertions: girl receives [1,2,3,4], all other seats receive no wolves/legalTargets during confession; illegal targets still rejected.
- [x] Run node --import tsx --test --test-isolation=none tests/wolf-girl-night.test.ts. Expected: new private-list assertion fails.
- [x] Extend girl's private response; preserve public/other-player projections.
- [x] Add mobile assertions for all teammate labels and disabled targets, self disabled, actor/background masking. Run existing girl spec; expected missing teammate label failure before UI change.
- [x] Render teammate text and accessible exclusion reason only for current private confession card. Run unit and girl mobile test; expected all pass.
- [x] Commit scoped task locally; ledger source/verification.

### Task 2: Touch-safe preparation choices

**Files:** Create apps/web/src/BoardPickerDialog.tsx, RoomSettingsChoices.tsx, preparationSettings.css; modify BoardConfigurationPanel.tsx, PreparationPanel.tsx. Create tests/e2e/preparation-settings.spec.ts and helpers/preparation-settings.ts; migrate existing board/mode selection tests.

**Interfaces:** BoardPickerDialog consumes library:BoardLibrary, board:RoomBoardSnapshot, onSelect:(id:string)=>void, onClose:()=>void. RoomSettingsChoices consumes settings:RoomSettings, settingsRevision:number, blocked:boolean, testRoom:boolean, onChange:(settings:RoomSettings)=>void; key by room/game context. Existing onAction(board/settings) payloads remain.

- [x] Add real-browser regressions for board preview/cancel preserving readiness, one confirm changing board, mode preview/cancel/no-op/confirm, stale update/disconnection, and keyboard/phone layout/test restrictions.
- [x] Run preparation-settings.spec.ts; expected missing new controls or immediate mutation failures.
- [x] Implement native dialog board preview, public roster summary, stable footer and focus return; close on invalidating revisions/busy/disconnect.
- [x] Implement radio-card drafts, descriptions, shared confirm/cancel, revision/blocked reset and scoped CSS.
- [x] Migrate old selectOption interactions to real new controls using helper; fix physical fixture's hard-coded revision to actual confirmed revision (two fields now one commit).
- [x] Run new and affected E2E; inspect 320/390/430 screenshots. Expected real room/readiness assertions pass and controls fit.
- [x] Run npm test, npm run typecheck, npm run build, full npm run test:e2e and npm run test:pwa. Expected zero final failures/skips; retain failure history.
- [x] Read React best-practices, request fresh whole-branch review, address important findings with red→green evidence.
- [x] Update rules/expectations/matrix/decisions/status/report/readme with actual results, commit, record implementationSHA, push this branch and create a PR; verify remoteSHA. Owner explicitly authorized merge/deploy after checks: merge only the verified head, confirm the resulting tree, deploy the existing Render service and record platform evidence/public-network limits.
