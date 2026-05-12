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

**Phase 2 — M12 Client Capabilities.**

- [x] M12.1 spec/SDK reconciliation against MCP 2025-11-25 + SDK 1.29 (findings in `context/DECISIONS.md` decision #13).
- [x] M12.2 advertise client capabilities (`sampling`, `elicitation` form+url, `roots.listChanged`) on `new Client(...)`.
- [x] M12.3 roots editor + `notifications/roots/list_changed` (file:// only).
- [ ] M12.4 sampling response panel (developer-composed mock; no LLM backend).
- [ ] M12.5 elicitation modal — form mode via `SchemaForm`, URL mode via `shell.openExternal`, three actions + completion notification.
- [ ] M12.6 progress + cancellation (`notifications/progress`, `notifications/cancelled`).

## Current Task

M12.4 — sampling response panel (developer-composed mock response; no LLM backend).

## Completed This Session (Phase 2 — M12)

- M12.1: reconciled MCP spec 2025-11-25 against `@modelcontextprotocol/sdk` 1.29.0. Recorded findings in `context/DECISIONS.md` (decision #13): advertise `sampling`, `elicitation` (`form` + `url`), `roots.listChanged`; defer the SDK's newer `tasks` capability (PLAN.md predates it — filed as backlog P7); skip `sampling.tools` (LLM backend is Phase 3) and `sampling.context` (soft-deprecated). Captured new spec surfaces to honor in later M12.x work: `URLElicitationRequiredError` (-32042), `notifications/elicitation/complete`, three-action elicitation response model, and `file://`-only roots. M12.6 cancellation will use `notifications/cancelled` (non-task path).
- M12.2: added `src/main/mcp/client-capabilities.ts` (`CLIENT_CAPABILITIES = { sampling: {}, elicitation: { form: {}, url: {} }, roots: { listChanged: true } }`) and wired it into the `new Client(...)` call in `session-manager.ts` alongside the existing `enforceStrictCapabilities: true`. Added `tests/client-capabilities.test.ts` (3 tests) asserting the shape parses against the SDK's `ClientCapabilitiesSchema` and that deferred capabilities (`tasks`, `sampling.tools`, `sampling.context`) stay out. Full suite: 81 tests pass.
- M12.3: added per-profile workspace roots. Persistence: migration `0003_add_profile_roots` adds `roots_json` to `server_profiles`; repo round-trips a `roots: ProfileRoot[]` field on `ServerProfile`, rejects non-`file://` URIs at the trust boundary, and exposes a new `getServerProfile(id)` helper. IPC: extended `ServerProfile`/`UpsertServerProfileInput` (and matching Zod schemas) with optional `roots`. Session manager: new `src/main/mcp/session/roots.ts` registers a `ListRootsRequestSchema` handler on every `new Client(...)` that re-reads roots from the repo on each `roots/list` call, plus a `notifyRootsChanged(profileId)` SessionManager method that fires `client.sendRootsListChanged()` on every ready session bound to that profile. Renderer: server-store gained a `rootsRaw` form field and an `updateProfileRoots(id, raw)` action; sidebar shows roots count per profile with an inline editor (textarea, `file:///...` or `name|file:///...` per line, `file://` validated client-side). Tests: `tests/session-roots.test.ts` (handler returns latest roots on each call; notify forwards correctly), plus 3 new `serverProfilesRepo` tests and 6 new `server-store-utils` tests. Docs: `SECURITY.md` gained a "Client Capabilities Advertised to Servers" section noting the roots disclosure and `file://`-only constraint; `README.md` feature table gained a Workspace roots row. Full suite: 92 tests pass; `pnpm build` clean.

## Completed This Session (Phase 2 Kickoff)

- Added `src/main/persistence/migrations/` with a versioned runner: `schema_migrations` tracks applied ids, migrations run inside a transaction in id order, duplicate ids are rejected. Migration `0001_initial_schema` captures the current schema idempotently (CREATE IF NOT EXISTS + `addColumnIfMissing`). Migration `0002_migrate_legacy_sse_profiles` rewrites legacy `sse` rows in `server_profiles` and `sessions` to `streamable-http` at boot.
- Removed legacy SSE transport: dropped `'sse'` from `SessionTransport`, deleted the renderer's convert-to-Streamable-HTTP path (sidebar button + `convertLegacySseProfile` store action), renamed renderer form fields (`sseUrl` → `httpUrl`, `sseHeadersRaw` → `httpHeadersRaw`, `parseSseHeadersRaw` → `parseHttpHeadersRaw`), simplified `migratePlaintextHeaders` to only target `streamable-http`. Existing SSE rows are auto-migrated on first launch, so no user action is required.
- Decoupled persistence and crypto from Electron globals (M11.3): `safe-storage` accepts a `SafeStorageProvider` via `initSafeStorage`; `database.ts` no longer imports `electron`, exposes `initDatabase(userDataDir)` + `getDatabase()`. Main wires both at `app.whenReady()`. Tests no longer need to mock `electron`.
- Centralized IPC Zod validation (M11.4): added `src/main/ipc/schemas.ts` (one Zod schema per channel, compile-time `Equals` assertions vs IPC contract types) and `src/main/ipc/register.ts` (`registerIpcHandler` + `registerIpcHandlerNoInput` helpers). Replaced all 19 `ipcMain.handle(...)` calls in `index.ts`. Invalid input now throws `AppError('INVALID_INPUT', …, { channel })`, which Electron propagates to the renderer's `invoke()` rejection. Transport-level Zod schemas in `stdio-transport.ts` / `streamable-http-transport.ts` remain as defense-in-depth.
- Split `session-manager.ts` (M11.5) from 601 LOC into a 287-LOC facade plus four focused modules under `src/main/mcp/session/`: `state-machine.ts` (37 LOC — `transitionSessionState`, `RuntimeSession` type), `tracing.ts` (91 LOC — `MessageRecorder` owning the listeners + outbound-request-time map and the JSON-RPC capture logic), `discovery.ts` (123 LOC — pure functions over the MCP `Client` for tools/resources/prompts), `status.ts` (82 LOC — `buildStatusFromRuntime`, `buildStatusFromPersisted`, `mapSessionSummary`, `getDurationMs`). Public API of `SessionManager` and the `sessionManager` singleton is unchanged; existing tests pass without modification.
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
