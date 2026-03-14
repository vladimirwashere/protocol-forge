# Protocol Forge — Current Status

**Last updated:** 2026-03-14

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

## Completed This Session

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
- Polling fallback for message refresh still exists alongside push stream; defer removal to next optimization pass.
