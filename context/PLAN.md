# Protocol Forge — Phase 1 Build Scope

## Build Description

Desktop Electron app for debugging, inspecting, and testing MCP (Model Context Protocol) servers. Phase 1 focuses on local workflows: connect via stdio/SSE, discover capabilities, invoke tools/resources/prompts, and inspect JSON-RPC traffic in real time.

**Stack:** Electron 35 · React 19 · TypeScript (strict) · electron-vite · Zustand · Tailwind CSS 4 · SQLite (better-sqlite3) · MCP SDK · Zod · Vitest · pnpm

## Milestones

### M1 — Project Scaffold & Tooling

Bootable Electron + React + Vite skeleton. ESLint, Prettier, Vitest, Tailwind configured. Dev/build/test scripts working.

### M2 — Secure Electron Boundaries & Typed IPC

Hardened BrowserWindow (contextIsolation, sandbox, no nodeIntegration, CSP). Typed IPC channel contract in `src/shared/ipc.ts`. Preload bridge via contextBridge. Zod-validated IPC handlers. Ping/pong proof of wiring.

### M3 — Local Persistence (SQLite)

SQLite in WAL mode with foreign keys. Schema: `server_profiles`, `sessions`, `messages`. Repository-pattern data access layer. Server profile CRUD wired through IPC.

### M4 — MCP Stdio Transport & Session Management

Session manager with lifecycle state machine (connecting → initializing → ready → disconnecting → disconnected | error). Stdio transport wrapping MCP SDK. Protocol message capture + persistence. Connect/disconnect/status IPC.

### M5 — SSE Transport & Unified Transport

SSE transport wrapping MCP SDK. Unified transport factory so session manager doesn't care about transport type. URL + header validation. SSE profile persistence in renderer.

### M6 — Core UI Shell

Dark-mode app shell with resizable sidebar/main/inspector layout. Zustand stores for server, session, UI state. Server sidebar with profile CRUD + connect. Status bar. Keyboard shortcuts. Inspector height persistence. Empty + error states.

### M7 — Discovery & Tool Invocation

IPC handlers for list-tools, list-resources, list-prompts, call-tool, read-resource, get-prompt. Tabbed discovery panel. Schema-driven form generator (SchemaForm). Invocation flow: select → fill → execute → view. Result renderer (JSON tree, raw toggle, copy). Resource + prompt viewers. Loading + error states.

### M8 — Protocol Inspector

Message Zustand store with bounded buffer. Batched IPC push from main (flush every 100ms or 50 messages). Virtualized message list. Detail panel with formatted JSON, direction, method, timestamp. Filters: direction, method, text search. Clear/pause/copy.

### M9 — Session History & Timings

Session history UI grouped by server. Load historical messages from DB. Session metadata (duration, count). Latency measurement on invocations. Latency display in inspector + results. Basic stats per session.

### M10 — Error UX, Polish & Architecture Review

Audit all error paths. Toast/notification system. React error boundaries. Improved empty states. App menu. Architecture + development docs. Known limitations + Phase 2 recommendations. Address polish backlog.

## Success Criteria

Each milestone is complete when every criterion in its checklist passes. Do not add scope beyond these items.

### M1 — Scaffold & Tooling

- [ ] App launches via `pnpm dev` with hot reload
- [ ] `pnpm test` runs Vitest and passes
- [ ] `pnpm lint` passes with zero warnings
- [ ] Tailwind classes render in the browser window

### M2 — Secure Boundaries & Typed IPC

- [ ] BrowserWindow has contextIsolation, sandbox, no nodeIntegration
- [ ] `window.api.ping()` returns `{ ok: true }` from main process
- [ ] IPC payloads validated with Zod; malformed input is rejected
- [ ] Renderer cannot access `require`, `process`, or `__dirname`

### M3 — Local Persistence

- [ ] SQLite DB created in app userData on first launch
- [ ] Server profiles persist across app restarts
- [ ] Create, read, update, delete profile via IPC all work
- [ ] Unit tests pass for repo operations

### M4 — Stdio Transport & Sessions

- [ ] Can connect to a local stdio MCP server (e.g. `npx @modelcontextprotocol/server-everything`)
- [ ] Session transitions through connecting → initializing → ready
- [ ] Protocol messages captured and persisted to messages table
- [ ] Disconnect cleanly terminates child process
- [ ] Session lifecycle tests pass

### M5 — SSE Transport

- [ ] Can connect to an SSE MCP server by URL
- [ ] SSE and stdio share the same session manager interface
- [ ] URL validation rejects non-http(s) schemes
- [ ] Transport factory tests pass

### M6 — Core UI Shell

- [ ] Dark-mode layout renders with sidebar, main area, inspector panel
- [ ] Inspector panel resizable via drag handle
- [ ] Server profiles load from DB on app start
- [ ] Save/edit/delete profile works from sidebar form
- [ ] Connect button establishes session; status bar reflects state
- [ ] Keyboard shortcuts (Cmd+N) functional

### M7 — Discovery & Invocation

- [ ] Tools/resources/prompts listed in tabbed panel after connecting
- [ ] SchemaForm renders input fields from a tool's JSON Schema
- [ ] Tool invocation returns result displayed in JSON tree view
- [ ] Raw toggle and copy button work on result renderer
- [ ] Resource read and prompt get display content
- [ ] Loading spinners and error messages appear for all operations

### M8 — Protocol Inspector

- [ ] Messages stream into inspector panel during tool invocation (push, not polling)
- [ ] Message list renders without lag at 300+ messages (virtualized)
- [ ] Direction filter (all/inbound/outbound) filters correctly
- [ ] Method filter narrows by JSON-RPC method name
- [ ] Text search matches against payload content
- [ ] Pause stops new messages from appearing; resume catches up
- [ ] Clear empties the visible buffer
- [ ] Selecting a message shows formatted JSON detail with copy button

### M9 — Session History & Timings

- [ ] Past sessions listed, grouped by server profile
- [ ] Selecting a past session loads its messages from DB
- [ ] Session metadata shows duration, message count, server info
- [ ] Tool invocations display round-trip latency in ms
- [ ] Inspector messages show latency where applicable
- [ ] Per-session stats: total messages, avg latency, error count

### M10 — Error UX & Polish

- [ ] Connection failures show actionable error message (not raw stack trace)
- [ ] Server crash during session shows error state in UI
- [ ] Toast notifications appear for transient errors
- [ ] React error boundaries prevent full-app crash from component errors
- [ ] App menu exists with standard shortcuts
- [ ] `docs/architecture.md` accurately describes process model and data flow
- [ ] `docs/development.md` covers setup, run, build, test
- [ ] Polish backlog items reviewed and addressed or explicitly deferred to Phase 2

## Risks & Unknowns

- Electron hardening correctness: keep renderer fully isolated and IPC validated.
- Schema-form scope creep: maintain strict Phase 1 support boundaries.
- Inspector performance under high message volume: rely on batching + virtualization.
- SQLite evolution: defer full migration system until schema stabilizes.
- Async error propagation across process boundaries: ensure actionable UI errors.

## Architecture Constraints (non-negotiable)

- **Process isolation:** strict main/preload/renderer separation. Renderer has zero Node access.
- **Typed IPC:** every channel has a typed contract in `src/shared/ipc.ts`, validated with Zod on the main side.
- **Trust boundary:** all external data (MCP server responses, user input) treated as untrusted.
- **Correctness → Security → Maintainability → Polish** (in that priority order).

## Scope Boundaries

In scope (Phase 1): App shell, secure IPC, SQLite persistence, stdio + SSE connections, discovery, tool invocation, protocol inspection, session history, basic latency timings, dark-mode UI, error handling, keyboard shortcuts, state persistence.

## Out of Scope (Phase 2+)

- Advanced profiling and performance monitoring
- Validation engine for tool inputs (beyond JSON Schema constraints)
- Exporting/importing session data
- Reporting and analytics dashboards
- CI integration for automated testing of MCP servers
- Team features (user accounts, shared sessions, permissions)
- Multi-window / multi-server simultaneous sessions
- Formal SQL migration runner (using addColumnIfMissing guards for now)
- Full JSON Schema support (Phase 1 covers flat objects, primitives, optional arrays)
- Plugin/extension system for custom renderers or transports
- Auto-update mechanism for the app itself
- Cloud syncing of profiles or sessions
