# Protocol Forge — Current Status

**Last updated:** 2026-04-20

## Completed Milestones

| Milestone | Summary |
| ----------- | --------- |
| M1 | Scaffold, electron-vite, ESLint/Prettier/Vitest/Tailwind configured |
| M2 | Hardened BrowserWindow, typed IPC contracts, Zod validation, contextBridge, ping/pong |
| M3 | SQLite (WAL, FK), server_profiles/sessions/messages schema, repo layer, CRUD IPC |
| M4 | Stdio session manager, lifecycle state machine, message capture + persistence |
| M5 | SSE transport, unified transport factory, URL + header validation, tests |
| M6 | Dark-mode shell, resizable layout, component split, Zustand stores, status bar, shortcuts |
| M7 | Discovery IPC handlers, tabbed discovery panel, SchemaForm, invocation flow, result renderer |
| M8 | Protocol Inspector push stream validated with live MCP server; idle discovery loop fixed |
| M9 | Session history grouped by profile, persisted history inspection, invocation latency capture, session stats surfaced in UI |
| M10 | Error UX pass: toasts, panel error boundaries, app menu, architecture/development docs, and known limitations recorded |

## In Progress

**Phase 1 complete.**

- [ ] Start Phase 2 planning when requested.

**Status:** M1-M10 are complete and validated.

## Completed This Session (Unreleased)

- Imported the user's login-shell `PATH` at main startup (`src/main/fix-env-path.ts`) so stdio MCP servers invoked via `npx`, `python`, `uvx`, etc. resolve when the app is launched from Finder/Dock. No new dependency; silently falls back to Electron's default `PATH` if the shell invocation fails.
- Piped the spawned stdio child's stderr and surfaced the last ~8 KB tail in `SESSION_CONNECT_FAILED` errors. Diagnosed by the error users actually see (e.g. npm 404s, missing node, permission denials) instead of just `MCP error -32000: Connection closed`.

## Completed This Session (v0.1.1)

- Added Streamable HTTP transport end-to-end (IPC variant, transport module, profile CRUD, UI, tests).
- Encrypted SSE and Streamable HTTP profile headers at rest via Electron `safeStorage`, with one-shot migration from plaintext rows on boot.
- Restricted stdio child-process env to the MCP SDK's default allowlist; user-supplied env entries still override it.
- Wired `electron-updater` with an in-app UI: toast on available/downloaded, Restart action, and "Check for Updates…" menu items.
- Deleted the stray duplicate SSE URL input in the sidebar.
- Retired the 1 s polling loop (decision P6) in favor of the push stream.
- Extracted the shared `TracingTransport` wrapper into its own module.
- Bumped version to v0.1.1; refreshed README, SECURITY.md, and architecture/development docs.

## Completed (Phase 1)

- Diagnosed stdio connect failures (`MCP error -32000: Connection closed`) to malformed saved args containing a literal `args:` token (`["args:", "@modelcontextprotocol/server-everything"]`).
- Added renderer-side input sanitization for labeled entries (`command:`, `args:`, `url:`) and connect-time normalization for legacy saved `args:` tokens.
- Added tests for new command/args/url sanitizers and legacy args normalization behavior.
- Fixed sandbox preload startup failure by removing `@electron-toolkit/preload` runtime import and exposing a local `window.electron.process.versions` bridge so `window.api` registers reliably in renderer.
- Extended session/message IPC contracts for M9 stats fields (`errorCount`, `avgLatencyMs`, `durationMs`) and optional profile linkage.
- Added SQLite schema backfills for `sessions.server_profile_id`, `messages.latency_ms`, and `messages.is_error`.
- Updated session persistence queries to expose grouped profile metadata and per-session aggregates.
- Implemented latency timing in session manager and discovery operations; response messages now carry latency/error metadata when applicable.
- Wired profile-aware session connection input from renderer (`profileId`) to persistence.
- Added grouped session history UI in inspector with per-session stats (messages, errors, avg latency, duration).
- Added latency badges in result rendering and protocol message details.
- Updated tests for repository/session/discovery changes; verified `pnpm test --run` passes.
- Updated `.github/copilot-instructions.md` to require `pnpm lint`, `pnpm typecheck`, `pnpm test --run`, and additional impacted checks (such as `pnpm build`) after every change/patch.
- Added app-wide toast notification infrastructure and surfaced transient discovery/session/profile errors as toasts.
- Added panel-level React error boundaries for sidebar, workspace/discovery, inspector, and status bar to isolate renderer failures.
- Added Electron application menu (File/Edit/View/Window/Help) with standard roles and safe external help links.
- Added `docs/architecture.md` and `docs/development.md`, including known limitations and Phase 2 recommendations.
- Renamed project identity from `MCP Scope` to `Protocol Forge` across app metadata, package name, docs, context files, persistence filename, UI preference key, and renderer branding.
- Ran full validation suite successfully: `pnpm lint`, `pnpm typecheck`, `pnpm test --run`, `pnpm build`.

## Known Issues / Gaps

- Manual windowing is used instead of `@tanstack/react-virtual` (intentional for M8).
- Streamable HTTP session resumption (sessionId + last-event-id) is not yet implemented; every connect creates a fresh MCP session.
