# Protocol Forge — Build Scope

## Build Description

Desktop Electron app for debugging, inspecting, and testing MCP (Model Context Protocol) servers. Phase 1 delivered the foundation: connect via stdio/Streamable HTTP, discover capabilities, invoke tools/resources/prompts, and inspect JSON-RPC traffic in real time with persistent session history. Phase 2 brings the app to full parity with the current MCP specification, adds workflow features that benefit from persistence (presets, export, diff, scripted runs), and ships security/conformance tooling that no other MCP client currently provides — turning Protocol Forge into a tool the community can rely on, not just another Inspector clone.

**Spec policy:** Phase 2 targets the latest stable MCP specification at the time each milestone begins, not a pinned snapshot. Specific spec-version references are intentionally absent from milestone descriptions so the plan ages with the protocol. The implementing engineer must consult `https://modelcontextprotocol.io` and the latest `@modelcontextprotocol/sdk` release notes before starting a milestone and reconcile any gaps in `context/DECISIONS.md`.

**Stack:** Electron 39 · React 19 · TypeScript (strict) · electron-vite · Zustand · Tailwind CSS 4 · SQLite (better-sqlite3) · MCP SDK · Zod · Vitest · pnpm

## Phase 1 Milestones (M1–M10, complete)

### M1 — Project Scaffold & Tooling

Bootable Electron + React + Vite skeleton. ESLint, Prettier, Vitest, Tailwind configured. Dev/build/test scripts working.

### M2 — Secure Electron Boundaries & Typed IPC

Hardened BrowserWindow (contextIsolation, sandbox, no nodeIntegration, CSP). Typed IPC channel contract in `src/shared/ipc.ts`. Preload bridge via contextBridge. Zod-validated IPC handlers. Ping/pong proof of wiring.

### M3 — Local Persistence (SQLite)

SQLite in WAL mode with foreign keys. Schema: `server_profiles`, `sessions`, `messages`. Repository-pattern data access layer. Server profile CRUD wired through IPC.

### M4 — MCP Stdio Transport & Session Management

Session manager with lifecycle state machine (connecting → initializing → ready → disconnecting → disconnected | error). Stdio transport wrapping MCP SDK. Protocol message capture + persistence. Connect/disconnect/status IPC.

### M5 — HTTP Transports & Unified Transport

SSE and Streamable HTTP transports wrapping MCP SDK (SSE deprecated 2025-03-26; Streamable HTTP is preferred). Unified transport factory so session manager doesn't care about transport type. URL + header validation + encryption for sensitive headers. HTTP profile persistence in renderer.

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

## Phase 1 Success Criteria

Each milestone is complete when every criterion in its checklist passes.

**Note:** M1–M10 are complete and validated (Phase 1 complete). See `context/STATUS.md` for current state.

### M1 — Scaffold & Tooling

- [x] App launches via `pnpm dev` with hot reload
- [x] `pnpm test` runs Vitest and passes
- [x] `pnpm lint` passes with zero warnings
- [x] Tailwind classes render in the browser window

### M2 — Secure Boundaries & Typed IPC

- [x] BrowserWindow has contextIsolation, sandbox, no nodeIntegration
- [x] `window.api.ping()` returns `{ ok: true }` from main process
- [x] IPC payloads validated with Zod; malformed input is rejected
- [x] Renderer cannot access `require`, `process`, or `__dirname`

### M3 — Local Persistence

- [x] SQLite DB created in app userData on first launch
- [x] Server profiles persist across app restarts
- [x] Create, read, update, delete profile via IPC all work
- [x] Unit tests pass for repo operations

### M4 — Stdio Transport & Sessions

- [x] Can connect to a local stdio MCP server (e.g. `npx @modelcontextprotocol/server-everything`)
- [x] Session transitions through connecting → initializing → ready
- [x] Protocol messages captured and persisted to messages table
- [x] Disconnect cleanly terminates child process
- [x] Session lifecycle tests pass

### M5 — HTTP Transports (SSE & Streamable HTTP)

- [x] Can connect to an SSE or Streamable HTTP MCP server by URL
- [x] HTTP and stdio transports share the same session manager interface
- [x] URL validation rejects non-http(s) schemes
- [x] Sensitive headers (auth tokens) are encrypted at rest
- [x] Transport factory tests pass

### M6 — Core UI Shell

- [x] Dark-mode layout renders with sidebar, main area, inspector panel
- [x] Inspector panel resizable via drag handle
- [x] Server profiles load from DB on app start
- [x] Save/edit/delete profile works from sidebar form
- [x] Connect button establishes session; status bar reflects state
- [x] Keyboard shortcuts (Cmd+N) functional

### M7 — Discovery & Invocation

- [x] Tools/resources/prompts listed in tabbed panel after connecting
- [x] SchemaForm renders input fields from a tool's JSON Schema
- [x] Tool invocation returns result displayed in JSON tree view
- [x] Raw toggle and copy button work on result renderer
- [x] Resource read and prompt get display content
- [x] Loading spinners and error messages appear for all operations

### M8 — Protocol Inspector

- [x] Messages stream into inspector panel during tool invocation (push, not polling)
- [x] Message list renders without lag at 300+ messages (virtualized)
- [x] Direction filter (all/inbound/outbound) filters correctly
- [x] Method filter narrows by JSON-RPC method name
- [x] Text search matches against payload content
- [x] Pause stops new messages from appearing; resume catches up
- [x] Clear empties the visible buffer
- [x] Selecting a message shows formatted JSON detail with copy button

### M9 — Session History & Timings

- [x] Past sessions listed, grouped by server profile
- [x] Selecting a past session loads its messages from DB
- [x] Session metadata shows duration, message count, server info
- [x] Tool invocations display round-trip latency in ms
- [x] Inspector messages show latency where applicable
- [x] Per-session stats: total messages, avg latency, error count

### M10 — Error UX & Polish

- [x] Connection failures show actionable error message (not raw stack trace)
- [x] Server crash during session shows error state in UI
- [x] Toast notifications appear for transient errors
- [x] React error boundaries prevent full-app crash from component errors
- [x] App menu exists with standard shortcuts
- [x] `docs/architecture.md` accurately describes process model and data flow
- [x] `docs/development.md` covers setup, run, build, test
- [x] Polish backlog items reviewed and addressed or explicitly deferred to Phase 2

## Phase 2 Milestones (M11–M21, proposed)

Sequencing rationale: M11 is a hard prerequisite — every later milestone touches session-manager and persistence. M12/M13 close protocol-parity gaps versus the current MCP spec. M14 unlocks real-world (OAuth-protected) servers, which M15 conformance/security tooling then needs to test against. M16 multi-server is an independent architectural track and can run in parallel with M17/M18 workflow features once M11 lands. M19 CLI extracts the now-mature core. M20 lifts SchemaForm constraints opportunistically. M21 absorbs polish, accessibility, and upcoming-spec readiness.

### M11 — Foundations & Tightening

Drop the legacy SSE transport path entirely; migrate any saved SSE profiles to Streamable HTTP on first boot. Introduce a versioned SQLite migration runner (decision **P1**) replacing the current `addColumnIfMissing` guards. Split `src/main/mcp/session-manager.ts` (600+ LOC) into focused modules — lifecycle state machine, discovery wrappers, tracing/latency, persistence bridge — each under 250 LOC. Centralize Zod-validation of IPC payloads behind a single typed helper instead of per-handler boilerplate. This is the only Phase 2 milestone that ships no user-visible feature; it exists to make every subsequent milestone tractable.

### M12 — Client Capabilities

Advertise and implement the client capabilities required by spec-compliant servers. Verify the SDK exposes each capability before starting; close gaps in `context/DECISIONS.md`. **Sampling**: server `sampling/createMessage` requests render in a dedicated panel where the developer composes or pastes a model response and replies — LLM-backend integration is deferred to Phase 3 to keep this milestone focused on protocol correctness. **Elicitation**: form-mode requests render as a modal reusing `SchemaForm`; URL-mode (or whichever interaction modes the current spec defines) requests open externally via `shell.openExternal`. **Roots**: per-profile editor for workspace roots; `notifications/roots/list_changed` emitted on change. **Progress and cancellation**: `notifications/progress` drives an in-flight progress bar on the active result; a Cancel button sends `notifications/cancelled` and unwires the latency timer.

### M13 — Server Feature Rendering

Render the rest of what a spec-compliant server may expose. Cross-check the current spec for feature additions before starting (annotations, output shapes, and notification surfaces evolve faster than transports). **Tool annotations** (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`, `icons`, plus any current additions) appear as badges in the tool list and invocation header; destructive tools require explicit confirmation before invocation. **Structured tool output**: when a tool returns `structuredContent` with an `outputSchema`, validate against the schema and render as a typed table alongside the raw `content` fallback. **Argument completion** via `completion/complete` powers autocomplete in `SchemaForm` for prompt arguments and resource template parameters. **Resource subscriptions**: subscribe/unsubscribe from a resource's detail view with live re-fetch on `notifications/resources/updated`. **Server logging**: `notifications/message` is surfaced in a dedicated Inspector "Logs" sub-panel filterable by level.

### M14 — Transport Hardening

Bring Streamable HTTP up to production parity. **OAuth 2.1** using whichever client-registration flow the current spec marks preferred (at planning time: Client ID Metadata Documents), with Dynamic Client Registration as a fallback. Tokens stored encrypted at rest via `safeStorage` with no plaintext fallback. **Session resumption**: persist `Mcp-Session-Id` and `last-event-id` per session so reconnect after a transient drop resumes rather than creating a new MCP session. Add an **experimental WebSocket transport** gated behind a feature flag while the upstream proposal stabilizes. No regressions in existing stdio + Streamable HTTP happy paths.

### M15 — Security & Conformance

The defining Phase 2 differentiator — make Protocol Forge a tool that vets MCP servers before users trust them. **Conformance**: integrate a harness (`@modelcontextprotocol/conformance` or `Janix-ai/mcp-validator`) runnable from a "Run Conformance" action on each profile; per-check pass/fail rendered in a dedicated report view. **Tool-poisoning scan**: integrate heuristics from MCP-Scan / Cisco mcp-scanner to detect prompt-injection patterns, suspicious tool descriptions, and confused-deputy risks; flag inline in the tool list with a security badge. **Fuzzing mode**: exercise tool inputs with malformed/edge cases (mcp-server-fuzzer) and produce a crash/error report. All scans are explicit user actions; none auto-run on connect.

### M16 — Multi-Server Sessions

Allow simultaneous connections to multiple MCP servers — a frequently requested Inspector feature and a workflow blocker for agent developers. Refactor the renderer session store from singleton to keyed-by-`sessionId`, with active-session selection in the sidebar. Inspector, discovery, and result panels become scoped to the active session. The message-stream IPC subscription multiplexes across sessions cleanly. Main-process persistence already supports multiple concurrent sessions — this milestone is renderer-architectural.

### M17 — Invocation Presets & Raw Composer

Cash in on persistent storage with named **invocation presets**: save a `{tool, args}` pair to a profile, re-run from the sidebar later. New `invocation_presets` table; CRUD via IPC. Add a **raw JSON-RPC composer** panel for cases the SchemaForm can't express — custom methods, deeply nested types, low-level testing. Support `{{VAR}}` substitution in profile fields and invocation args, backed by a per-profile encrypted env map; unresolved variables fail before send with a clear error.

### M18 — Session History UX

Make session history a first-class artefact. **Export** a session as NDJSON in a format compatible with the official Inspector's history JSON; **import** for offline replay or sharing. **Session diff**: pick two sessions of the same profile and see method-by-method aligned request/response diffs — invaluable when chasing a regression after a server upgrade. **Pinned messages and notes**: bookmark a message in the inspector, attach a markdown note that persists with the session.

### M19 — CLI & Scripted Runs

Extract a `protocol-forge` CLI binary built alongside the desktop app that shares main-process modules (transports, session manager, repos) but uses its own headless persistence path. Subcommands: `connect`, `tools list`, `tool call`, `session export`, `conformance run` — against a saved profile name or inline config. **Batch-run mode** reads a YAML or JS script of invocations and emits per-step structured JSON suitable for CI piping. Exit codes reflect success/failure. Prerequisite: M11 must inject the `userData` path so the session manager isn't bound to Electron's `app.getPath`.

### M20 — Schema Form Expansion

Lift the deliberate Phase 1 SchemaForm constraints (decision M7). Support nested objects (nested form sections), `oneOf`/`anyOf` (variant tab selector), arrays of objects (add/remove rows), defaults (pre-populated), `min`/`max`/`pattern`/`format` (validated on submit). Provide a **raw JSON editor fallback** with live Zod-validated parsing for anything the form can't express. Add a snapshot test suite covering representative MCP server schemas.

### M21 — Polish & Upcoming-Spec Readiness

Adopt `@tanstack/react-virtual` in the inspector message list — variable row heights, accurate scrolling, no clipped multi-line payloads (resolves the manual-windowing limitation called out in `context/STATUS.md`). Implement **Server Cards discovery** (`GET /.well-known/mcp.json` or whichever well-known path the current spec defines) so a user can paste a server URL and have profile fields auto-populated. Full keyboard navigation across the AppShell including layout resize (decision **P5**). Accessibility pass: focus-visible rings, ARIA labels, screen-reader-friendly inspector. App menu deep-links: "Open recent session," "Connect last profile," "Export current session."

## Phase 2 Success Criteria

**Note:** M11–M21 are proposed; not yet in progress. Each milestone is complete only when every criterion in its checklist passes. `pnpm lint && pnpm typecheck && pnpm test --run && pnpm build` must be green for every milestone — not repeated per checklist.

### M11 — Foundations & Tightening

- [ ] `'sse'` removed from `SessionTransport` union; transport factory has no SSE branch
- [ ] Legacy SSE profiles upgraded to Streamable HTTP on first boot with a one-shot migration
- [ ] `src/main/persistence/migrations/` runs numbered migrations on startup, tracked in a `schema_migrations` table; all `addColumnIfMissing` calls retired
- [ ] `session-manager.ts` split into ≥3 modules (lifecycle, discovery, tracing, persistence bridge), each under 250 LOC; existing session tests pass unchanged
- [ ] All IPC handlers route through a single typed Zod-validation helper
- [ ] Session manager accepts an injected `userData` path rather than calling `app.getPath` directly (CLI prerequisite)

### M12 — Client Capabilities

- [ ] Spec/SDK check recorded in `context/DECISIONS.md` before implementation begins
- [ ] Client capabilities `sampling`, `elicitation`, `roots` (plus any others the current spec defines) advertised on `initialize`
- [ ] Sampling `createMessage` request opens a panel; developer composes a mock response and replies; round-trip captured in session history
- [ ] Form-mode elicitation renders as a modal driven by `SchemaForm`; URL-mode opens via `shell.openExternal`
- [ ] Per-profile roots editor; `notifications/roots/list_changed` emitted on edit
- [ ] `notifications/progress` updates an in-flight progress bar on the active result
- [ ] Cancel button on an in-flight invocation sends `notifications/cancelled` and clears the latency timer
- [ ] Tests cover sampling-mock round-trip, elicitation form + URL modes, roots advertise/change, cancellation

### M13 — Server Feature Rendering

- [ ] Spec/SDK check recorded in `context/DECISIONS.md` before implementation begins
- [ ] Tool annotations rendered as badges in the tool list and invocation header (covering all annotation fields defined in the current spec)
- [ ] Tools with `destructiveHint: true` require explicit confirmation before invocation
- [ ] Tool results with `structuredContent` + `outputSchema` validated and rendered as a typed view beside raw `content`
- [ ] `completion/complete` powers autocomplete in `SchemaForm` for prompt args and resource template params
- [ ] Resource detail view supports subscribe/unsubscribe; subscribed resources auto-refresh on `notifications/resources/updated`
- [ ] Inspector includes a Logs sub-panel rendering `notifications/message` filterable by level (debug/info/warning/error)
- [ ] Tests cover annotation rendering, structured-output validation, completion calls, subscription lifecycle, log filtering

### M14 — Transport Hardening

- [ ] Streamable HTTP profiles support OAuth 2.1 with the registration flow currently marked preferred by the spec, plus DCR as fallback
- [ ] OAuth refresh/access tokens stored encrypted via `safeStorage`; no plaintext fallback for tokens
- [ ] `Mcp-Session-Id` and `last-event-id` persisted per session; reconnect after a transient drop resumes the same MCP session
- [ ] Experimental WebSocket transport behind a feature flag; basic happy-path test against a reference server
- [ ] No regressions in existing stdio + Streamable HTTP flows; existing tests pass

### M15 — Security & Conformance

- [ ] "Run Conformance" action on a profile runs an integrated harness and renders per-check pass/fail in a report view
- [ ] Tool list shows a security badge per tool driven by a poisoning/heuristic scan; details visible in the tool description panel
- [ ] "Run Fuzz" action exercises tool inputs with malformed/edge cases and produces a crash/error report
- [ ] Conformance and scan results persist in SQLite and are viewable from session history
- [ ] No scan runs without an explicit user action
- [ ] Tests cover at least one passing and one failing conformance scenario, and one positive-positive scan match

### M16 — Multi-Server Sessions

- [ ] Two or more sessions can be in `ready` state concurrently against different profiles
- [ ] Renderer session store keyed by `sessionId`; switching the active session swaps inspector + discovery + result views without loss
- [ ] Sidebar shows per-profile connection status; status reflects multiple active sessions
- [ ] Message-stream IPC subscription multiplexes correctly across sessions; no cross-session message bleed
- [ ] All Phase 1 single-session flows continue to work
- [ ] Tests cover multi-session connect/disconnect, active-session switching, message stream isolation

### M17 — Invocation Presets & Raw Composer

- [ ] `invocation_presets` table created via M11's migration runner; CRUD IPC handlers wired
- [ ] Preset list rendered in sidebar; one-click re-run executes the saved invocation on the active session
- [ ] Raw JSON-RPC composer panel sends arbitrary methods on the active session and displays the response
- [ ] `{{VAR}}` substitution resolves from a per-profile encrypted env map; unresolved variables fail before send with a clear error
- [ ] Tests cover preset CRUD, composer send/receive, env substitution success and failure paths

### M18 — Session History UX

- [ ] Export session to NDJSON file in a format readable by the official Inspector's import path
- [ ] Import session from NDJSON; imported sessions appear in history marked `imported`
- [ ] Session diff view aligns two sessions of the same profile and shows inline request/response diffs
- [ ] Pin a message and attach a markdown note; both persist in the messages table and render in the inspector detail
- [ ] Tests cover export-then-import round-trip, diff alignment with non-matching message counts, pin/note persistence

### M19 — CLI & Scripted Runs

- [ ] `protocol-forge` CLI binary built alongside the desktop app and runnable on macOS, Linux, Windows
- [ ] `connect`, `tools list`, `tool call`, `session export`, `conformance run` subcommands operate against a saved profile name or inline config
- [ ] Batch-run mode executes a script of invocations and emits per-step JSON results
- [ ] Exit codes reflect success (0), invocation failure (1), or configuration error (2)
- [ ] CLI documented in `docs/cli.md`; covered by integration tests against a local reference server

### M20 — Schema Form Expansion

- [ ] Nested objects render as nested form sections with collapse/expand
- [ ] `oneOf`/`anyOf` renders a variant tab selector; switching variants swaps the rendered fields
- [ ] Arrays of objects render as add/remove repeating rows
- [ ] Schema defaults pre-populate fields; `min`/`max`/`pattern`/`format` validated on submit
- [ ] Raw JSON editor fallback available per invocation with live Zod-validated parsing
- [ ] Snapshot tests against ≥3 representative MCP server schemas

### M21 — Polish & Upcoming-Spec Readiness

- [ ] Inspector message list uses `@tanstack/react-virtual` with variable row heights; no clipped multi-line payloads
- [ ] "Discover from URL" populates a new Streamable HTTP profile from a Server Card (`/.well-known/mcp.json`)
- [ ] AppShell splitters resizable via keyboard; tab order reaches every interactive control
- [ ] Inspector passes a basic accessibility audit (focus rings, ARIA labels, contrast)
- [ ] App menu entries for "Open recent session," "Connect last profile," "Export current session" all functional

## Risks & Unknowns

**Phase 1 (residual):**

- Electron hardening correctness: keep renderer fully isolated and IPC validated.
- Inspector performance under high message volume: rely on batching + virtualization (M21 swaps to `react-virtual`).
- Async error propagation across process boundaries: ensure actionable UI errors.

**Phase 2:**

- **Spec drift.** The MCP spec is on a rolling release cadence; capabilities, transports, and authorization mechanics may change between milestones. Before each Phase 2 milestone, check `https://modelcontextprotocol.io` and the latest `@modelcontextprotocol/sdk` release notes for changes that affect scope, and update the relevant milestone description rather than coding against a stale assumption.
- **MCP SDK lag behind spec.** New spec features land incrementally in `@modelcontextprotocol/sdk`. Each milestone that depends on a specific capability must verify SDK support before starting; if missing, defer the affected criterion or implement behind a feature flag rather than blocking the milestone.
- **OAuth surface area (M14).** Token storage and refresh-flow correctness are the highest-risk paths in Phase 2. Reuse `safeStorage`; never log tokens; treat refresh as a distinct code path from initial auth.
- **Upcoming-spec volatility (M21 and onward).** Items still in SEP/draft status (stateless transport, Server Cards / well-known discovery, triggers, skills, extensions framework, WebSocket transport) may shift before finalizing. Keep groundwork optional/flagged until upstream stabilizes.
- **CLI extraction coupling (M19).** Depends on M11 cleanly separating session-manager from Electron-specific bindings (`app.getPath`, `safeStorage`). Headless persistence path must be a clean injection point.
- **Conformance harness selection (M15).** Picking one upstream harness creates a soft dependency. Design the integration so the harness can be swapped without UI rework.
- **Multi-server state leaks (M16).** The renderer store rework is bounded but easy to get wrong — message-stream subscriptions multiplexed by `sessionId` need careful test coverage to avoid cross-session bleed.

## Architecture Constraints (non-negotiable)

- **Process isolation:** strict main/preload/renderer separation. Renderer has zero Node access.
- **Typed IPC:** every channel has a typed contract in `src/shared/ipc.ts`, validated with Zod on the main side.
- **Trust boundary:** all external data (MCP server responses, user input) treated as untrusted.
- **Correctness → Security → Maintainability → Polish** (in that priority order).
- **No silent scope expansion.** A milestone is the unit of agreed work; pulling Phase 3 items into Phase 2 requires an explicit plan update.

## Scope Boundaries

**In scope (Phase 1, complete):** App shell, secure IPC, SQLite persistence, stdio + SSE + Streamable HTTP connections, discovery, tool invocation, protocol inspection, session history, basic latency timings, dark-mode UI, error handling, keyboard shortcuts, state persistence, auto-update.

**In scope (Phase 2, proposed):** Foundations cleanup; full parity with the current MCP specification (client + server capabilities); OAuth + session resumption; conformance + security tooling; multi-server; invocation presets + composer; session export/import/diff/notes; CLI + batch runs; expanded SchemaForm; readiness for upcoming-spec features.

## Out of Scope (Phase 3+)

- LLM-backend integration for sampling (Anthropic/OpenAI/Ollama providers)
- Advanced profiling and performance monitoring beyond per-invocation latency
- Reporting and analytics dashboards
- Team features (user accounts, shared sessions, permissions)
- Cloud syncing of profiles or sessions
- Plugin/extension system for custom renderers or transports — wait for the upstream MCP extensions framework to stabilize before designing
- Stateless transport, triggers, skills (upcoming MCP roadmap items) — scaffold only when upstream stabilizes
- ~~Auto-update mechanism for the app itself~~ — shipped in v0.1.1 via `electron-updater`
- ~~Exporting/importing session data~~ — moved into Phase 2 M18
- ~~CI integration for automated testing of MCP servers~~ — moved into Phase 2 M19
- ~~Multi-window / multi-server simultaneous sessions~~ — moved into Phase 2 M16
- ~~Formal SQL migration runner~~ — moved into Phase 2 M11
- ~~Full JSON Schema support~~ — moved into Phase 2 M20 (partial; full validator remains out of scope)
