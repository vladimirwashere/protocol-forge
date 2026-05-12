# Protocol Forge — Current Status

**Last updated:** 2026-05-12

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

**Phase 2 kickoff — M11 Foundations & Tightening.**

- [x] M11.1 versioned migration runner with `schema_migrations` table.
- [x] M11.2 remove legacy SSE transport (auto-migrate existing rows).
- [x] M11.3 inject userData path + safeStorage provider (decouples persistence/crypto from Electron globals).
- [x] M11.4 centralize IPC Zod validation behind one helper.
- [ ] M11.5 split `session-manager.ts` into lifecycle/discovery/tracing/persistence modules.

## Current Task

M11 Foundations & Tightening. Next up: M11.5 split `session-manager.ts` into focused modules.

## Completed This Session (Phase 2 Kickoff)

- Added `src/main/persistence/migrations/` with a versioned runner: `schema_migrations` tracks applied ids, migrations run inside a transaction in id order, duplicate ids are rejected. Migration `0001_initial_schema` captures the current schema idempotently (CREATE IF NOT EXISTS + `addColumnIfMissing`). Migration `0002_migrate_legacy_sse_profiles` rewrites legacy `sse` rows in `server_profiles` and `sessions` to `streamable-http` at boot.
- Removed legacy SSE transport: dropped `'sse'` from `SessionTransport`, deleted the renderer's convert-to-Streamable-HTTP path (sidebar button + `convertLegacySseProfile` store action), renamed renderer form fields (`sseUrl` → `httpUrl`, `sseHeadersRaw` → `httpHeadersRaw`, `parseSseHeadersRaw` → `parseHttpHeadersRaw`), simplified `migratePlaintextHeaders` to only target `streamable-http`. Existing SSE rows are auto-migrated on first launch, so no user action is required.
- Decoupled persistence and crypto from Electron globals (M11.3): `safe-storage` accepts a `SafeStorageProvider` via `initSafeStorage`; `database.ts` no longer imports `electron`, exposes `initDatabase(userDataDir)` + `getDatabase()`. Main wires both at `app.whenReady()`. Tests no longer need to mock `electron`.
- Centralized IPC Zod validation (M11.4): added `src/main/ipc/schemas.ts` (one Zod schema per channel, compile-time `Equals` assertions vs IPC contract types) and `src/main/ipc/register.ts` (`registerIpcHandler` + `registerIpcHandlerNoInput` helpers). Replaced all 19 `ipcMain.handle(...)` calls in `index.ts`. Invalid input now throws `AppError('INVALID_INPUT', …, { channel })`, which Electron propagates to the renderer's `invoke()` rejection. Transport-level Zod schemas in `stdio-transport.ts` / `streamable-http-transport.ts` remain as defense-in-depth.
- Added `tests/migration-runner.test.ts`, `tests/migration-0002-sse.test.ts`, and `tests/ipc-register.test.ts`; updated `tests/server-profiles-repo.test.ts`, `tests/database-migration.test.ts`, and `tests/server-store-utils.test.ts` for the new contracts. Full suite: 78 tests pass.
- Refreshed docs (`README.md`, `docs/architecture.md`, `docs/development.md`, `SECURITY.md`, `CLAUDE.md`, `.github/copilot-instructions.md`) to drop SSE from supported transports.

## Completed This Session (Unreleased)

- Pinned transitive `ip-address` to `10.1.1` via a root pnpm override and refreshed `pnpm-lock.yaml`, removing the vulnerable `10.1.0` resolution from both runtime and build-time dependency trees.

- Responsive AppShell layout: replaced the draggable inspector splitter with preset-based drawer control (collapsed/split/expanded buttons on wide viewports ≥900px, and a three-tab single-column layout below 900px for Servers/Workspace/Inspector). Added `useIsNarrow` hook and updated ui-store to persist `inspectorView` + `narrowTab` state. Fixes content overflow behind siblings by adding `min-h-0 overflow-y-auto` to sidebar and main regions.
- Fixed status bar overflow on long session IDs and error strings: added `truncate` and `min-w-0` overflow guards; removed duplicate `border-t` (AppShell footer already has one).
- Fixed ProtocolInspector filter/message grids: changed from viewport-relative `md:` breakpoints to column-relative `grid-cols-3` and `grid-cols-2` so they render correctly at 900–1067px wide viewports. Clamped scroll pane heights with `max-h-[min(14rem,40vh)]` for short viewports.
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
