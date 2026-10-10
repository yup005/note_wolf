# Werewolf Lobby Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task by task. User authorized direct native execution.

**Goal:** Deliver local create / join / first-seat selection with real multi-device synchronization.
**Architecture:** Typed domain and public contracts; transactional SQLite persistence; same-origin HTTP commands and Socket.IO snapshots; React mobile UI.
**Tech Stack:** Node >=24, TypeScript, React, Vite, Express, Socket.IO, better-sqlite3, node test, Playwright.
**Spec:** docs/superpowers/specs/2026-10-09-werewolf-lobby-design.md

## Global Constraints
- 12 seats; four-digit strings including leading zero; never authorize by room code alone.
- Confirmed rules only; no dealing / game start / VIP / comments / social.
- Public snapshots contain no secret tokens or role data.
- Session stored in HttpOnly same-origin cookie; anonymous host warning once per device.
- Disconnection and refresh preserve seats; unresolved reseating policy rejects changes.

## Review Focus
- Concurrent seat requests must never overwrite another member (task 2/3).
- Invalid inputs and unknown room codes show actionable errors (task 2/4).
- Reconnect, duplicate requests and service restart restore canonical state (task 2/3/4).
- Unauthorized HTTP/socket requests never return members' credentials (task 3).
- Keyboard deletion/paste and narrow mobile screens remain usable (task 4).

### Task 1: Foundation
Files: package.json, tsconfig.json, vite.config.ts, .gitignore; tests/foundation.test.ts.
Produces: installable scripts, Node runtime, directory structure.
- [x] Install dependencies and verify Node and SQLite runtime via foundation test.
- [x] npm test -- foundation; npm run typecheck.

### Task 2: Domain / storage
Files: packages/contracts/index.ts, packages/domain/board.ts, packages/storage/lobby.ts; tests/lobby.test.ts.
Produces: LobbyStore.create(token,nickname), join(token,code,nickname), select(token,roomId,seat), view(token,roomId), close().
- [x] Write tests for leading zeros, code collisions, capacity exhaustion, member idempotency, authorization, valid seat range, contention, persistence and unresolved seat changes; watch RED.
- [x] Define public RoomSnapshot and MyMembership; confirmed BoardDefinition with unresolved policy entries.
- [x] Implement SQLite migrations and transactional server-side validation; never broadcast session tokens.
- [x] Run npm test, typecheck; record results.

### Task 3: HTTP / realtime
Files: apps/server/app.ts, main.ts; tests/server.test.ts.
Consumes: LobbyStore, RoomSnapshot. Produces: createServer({dbPath,production}) and same-origin /api/session, /api/rooms, /api/rooms/join, /api/rooms/:id, /api/rooms/:id/seat; room:subscribe and room:snapshot.
- [x] Write tests against real HTTP server and websocket clients; watch RED.
- [x] Implement cookie auth, origin validation, rate limits, validated commands, sanitized errors, membership-gated snapshots and reconnect subscriptions.
- [x] Run full npm test; health endpoint and typecheck.

### Task 4: UI / browsers
Files: apps/web/index.html, src/{App,OtpInput,RoomLobby,useRoom}.tsx/ts, src/style.css; playwright.config.ts; tests/e2e/lobby.spec.ts.
Consumes: HTTP contracts and snapshot subscription. Produces: complete Chinese mobile lobby flow.
- [x] Write three-context browser flow including OTP backspace/paste, seat race, refresh and full capacity; run to see RED.
- [x] Build responsive white card UI, host warning, accessible OTP, status and room restoration. Reject old snapshots.
- [x] Run npm test:e2e and build; inspect screenshot.

### Task 5: Delivery
Files: README.md, docs/TEST_REPORT.md, docs/PROGRESS.md, OPEN_QUESTIONS.md.
- [x] Review whole branch; fix important findings with regression tests.
- [x] Run npm test, npm run typecheck, npm run build and npm run test:e2e.
- [x] Document local/LAN launch, real browser evidence and all unresolved rules and limitations; keep changes on current work branch without external publish.
