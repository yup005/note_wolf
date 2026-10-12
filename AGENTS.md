# Codex project instructions — note_wolf

## Scope and safety
- Mobile-first in-person Werewolf app; prioritize iPhone Safari and preserve existing architecture/UI. Preserve the standard **12-player 预女猎白** (4 wolves, 4 villagers, one seer, witch, hunter, idiot). The owner authorized mechanical/armor development on 2026-10-10 and continued implementation before deployment on 2026-10-11. Confirmed mechanical/armor and custom-board flows are implemented locally; unresolved interactions remain explicitly blocked, and the separate 14-player dual-category idiot policy is not selectable. 九尾/白泽 and other boards require explicit owner authorization; discussion docs alone do not authorize implementation. Code delivery does not authorize deployment or claim physical-device acceptance.
- Protect ongoing real-player identities, private skills/results and unpublished notes in every interface, log, speech cue and document. Hosts/admins gain no secret access; test-only access is limited to simulated players and disabled in production by default. Owner confirmed a future Render-trial exception on 2026-10-11: administrator-only independent simulated test rooms, after authorization/isolation implementation and verification; it remains disabled now (BETA-004).
- Preserve user edits and useful history. Never invent unresolved gameplay, force-push, discard conflicting work, bypass checks/hooks or publish credentials/live data. Physical iPhone acceptance is separate from browser simulation.

## Every task
1. Follow [safe requirements preflight](docs/CODEX_WORKFLOW.md#before-every-new-task-safely-sync-requirements): inspect local changes/branch/upstream, fetch origin, compare incoming commits and safely integrate requirements. If blocked, report the exact reason; do not claim synchronization or silently overwrite local work.
2. Use [DOCUMENTATION_MAP.md](docs/DOCUMENTATION_MAP.md) to read the relevant confirmed decisions, rules and requirement IDs. Inspect current code/tests and implement only missing work. Explicit newer confirmations supersede old wording; proposals/code alone do not resolve a rule. Ask when a required decision is missing.
3. Follow the [standing Git workflow](docs/CODEX_WORKFLOW.md#standing-git-workflow-preference-authorized-by-project-owner) and [progress requirements](docs/CODEX_WORKFLOW.md#maintain-progress-after-each-completed-task): publish by **completed feature, bug fix or documentation batch**. Save intermediate edits locally; do not push for every message or small change. At the delivery boundary, run required checks, update docs/progress, review scoped diff, **automatically commit and push** on the current branch, verify the remote SHA and report GitHub links. No repeated commit/push reminder is needed. Never merge a PR without specific owner authorization.
4. For code/bugfix tasks run `npm test`, `npm run typecheck`, `npm run build`, plus applicable browser tests for UI changes; broad UI snapshots need full E2E. Documentation-only work uses document/link/diff checks and reports that code tests were not rerun. Stop publication when required checks fail or cannot run.

## Read the detailed sections when applicable
The linked [CODEX_WORKFLOW.md](docs/CODEX_WORKFLOW.md) is mandatory project guidance. Read the sections named above for every task and the additional sections relevant to the work:
- Product/rule updates: **Product documentation sync**, **Standing rule-document maintenance**.
- Testing, authentication or private data: **Verification environment and privacy**.
- Deleting obsolete/duplicate artifacts: **Authorized routine cleanup**.
- Large documentation updates, simplification or reorganization: **Authorized documentation optimization**.

Maintain confirmed rules and acceptance details, versions/IDs and source history; keep confirmation, implementation and verification separate. Codex cannot read unsynced ChatGPT chats. This workflow applies during task execution, not as a background watcher.
