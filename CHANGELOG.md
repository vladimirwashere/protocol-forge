# Changelog

All notable changes to Protocol Forge are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-05-13

### Added

- **Workspace roots per profile.** Each profile now carries a list of
  `file://` workspace roots advertised to the server via `roots/list`;
  edits emit `notifications/roots/list_changed` to every ready session
  bound to that profile.
- **Sampling response panel.** When a server calls
  `sampling/createMessage`, the request appears in an in-app panel
  where the developer composes a mock response (text/image/audio) by
  hand and replies. No LLM backend is contacted — this is a protocol
  surface for inspection, not a generation backend.
- **Elicitation modal.** Server-initiated `elicitation/create` requests
  open a modal with three actions (Accept / Decline / Cancel). Form
  mode renders the requested schema (string / enum / number / boolean
  / array); URL mode routes through `shell.openExternal` only after an
  explicit Accept.
- **In-flight progress + cancellation.** Tool/resource/prompt
  invocations now stream live `notifications/progress` updates into a
  dedicated panel and can be cancelled mid-call. Cancellation aborts
  the in-flight request and emits `notifications/cancelled` so the
  server can stop work.
- **Typed tool annotations.** `readOnlyHint`, `destructiveHint`,
  `idempotentHint`, `openWorldHint`, plus tool `title` and `icons` are
  projected defensively from the server and rendered as badges in the
  tool list and invocation header. Tools marked `destructiveHint: true`
  require explicit confirmation before invocation. Annotations are
  treated as untrusted hints, not security guarantees.
- **Structured tool output validation.** Tool results carrying
  `structuredContent` are validated against the tool's declared
  `outputSchema`; pass/fail status surfaces above a typed view, and
  the raw `content` payload remains available as a fallback.
- **Prompt argument completion.** Prompt argument fields gain
  debounced autocomplete via `completion/complete` (gated on
  `serverCapabilities.completions`); other filled arguments are sent
  as `context.arguments` for cascading completions.
- **Resource templates.** Resource templates from
  `resources/templates/list` render in a Templates sub-section with a
  per-template form that parses `{name}` placeholders (RFC 6570
  operator prefixes stripped), reuses the completion plumbing with
  `ref/resource`, and URI-encodes values on submit.
- **Resource subscriptions.** Subscribe/unsubscribe on resource list
  entries with a "Live" badge and auto-refetch on
  `notifications/resources/updated` (gated on
  `serverCapabilities.resources.subscribe`). Subscriptions are
  session-scoped and drained on disconnect.
- **Server logging sub-panel.** When a server advertises the
  `logging` capability, the Inspector exposes a Logs sub-panel
  showing live `notifications/message` entries with their RFC 5424
  level, optional `logger` namespace, and pretty-printed `data`. A
  server-level selector calls `logging/setLevel`; an in-app filter
  further narrows the view by minimum severity.
- **Responsive AppShell.** Replaced the draggable inspector splitter
  with preset-based drawer control (collapsed / split / expanded on
  wide viewports, three-tab single-column below 900px).

### Changed

- **Breaking — legacy SSE transport removed.** `'sse'` is no longer a
  valid `SessionTransport`. Existing SSE profiles and historical SSE
  sessions are auto-rewritten to `streamable-http` on first launch
  via a one-shot migration, so no user action is required.
- **Versioned schema migrations.** Database schema changes now run
  through a numbered migration runner tracked in a new
  `schema_migrations` table (transactional, ordered, duplicate-id
  rejection). The legacy `addColumnIfMissing` guards have been
  retired.
- **Internal refactors.** `session-manager.ts` split into focused
  modules (state machine, tracing, discovery, status). Persistence
  and crypto decoupled from Electron globals — `userData` and
  `safeStorage` are now injected at boot. IPC validation centralized
  behind `registerIpcHandler` (single Zod helper with compile-time
  `Equals` guards against the IPC contract).
- **Stdio child PATH.** Main now imports the user's login-shell PATH
  at startup so stdio MCP servers invoked via `npx` / `python` /
  `uvx` resolve when the app launches from Finder / Dock / a GUI
  launcher. Already shipped in v0.1.2; re-listed here as part of the
  cumulative changelog.

### Security

- **`ip-address` pinned to `10.1.1`** via a root pnpm override,
  removing the vulnerable `10.1.0` resolution from both runtime and
  build-time dependency trees.

### Fixed

- Status bar overflow on long session IDs and error strings.
- Protocol Inspector filter/message grids now render correctly at
  900–1067 px viewport widths (column-relative breakpoints replaced
  viewport-relative ones).

[0.2.0]: https://github.com/vladimirwashere/protocol-forge/releases/tag/v0.2.0

## [0.1.2] - 2026-04-21

### Added

- **Captured child-process stderr on stdio connect failures.** The stdio
  transport now pipes the spawned server's stderr and surfaces the last ~8 KB
  in the error returned to the UI when a connect fails (`SESSION_CONNECT_FAILED`).
  Previously these failures showed only the MCP-level message (typically
  `MCP error -32000: Connection closed`) with no way to see what the server
  actually complained about. The captured tail is now visible in the
  session-error toast and the session record.

### Fixed

- **`stdio` profiles no longer fail with `spawn npx ENOENT` when the app is
  launched from Finder/Dock on macOS (or a GUI launcher on Linux).** The main
  process now invokes the user's login shell once at startup to import their
  real `PATH`, so child processes can resolve Homebrew, nvm, pyenv, and other
  non-default binaries. Windows is unaffected (GUI-launched processes inherit
  `PATH` correctly there). If the shell invocation fails (exotic shell, broken
  rc file, or timeout), the app falls back to the Electron default `PATH`
  without blocking startup.

## [0.1.1] - 2026-04-20

### Added

- **Streamable HTTP transport**, the MCP spec successor to SSE. Server
  profiles and session connects now accept `transport: streamable-http`
  end-to-end.
- **Auto-update**: the main process wires `electron-updater` against the
  draft-release manifests already published by CI. The app checks on
  launch, shows a toast when an update is available, and offers a
  one-click "Restart" action once an update is downloaded. A
  "Check for Updates…" menu item is also available under the app menu
  (macOS) / Help menu (Windows/Linux).
- **Encrypted storage** for `sse` and `streamable-http` profile request
  headers. Headers are written via Electron `safeStorage` (Keychain on
  macOS, DPAPI on Windows, libsecret on Linux) into a new `headers_enc`
  column. Existing plaintext rows from v0.1.0 are migrated in place on
  first launch. On Linux hosts without a libsecret-compatible keyring,
  Protocol Forge logs a warning and falls back to plaintext.

### Changed

- **Breaking (stdio profiles):** spawned stdio MCP servers now inherit
  only the SDK's default environment allowlist (`PATH`, `HOME`, `USER`,
  and platform equivalents) instead of the full host `process.env`.
  Servers that relied on arbitrary host env vars (`NODE_PATH`,
  `PYTHONPATH`, custom language config) need an explicit entry in the
  profile's env field. User-supplied env entries still override the
  allowlist.
- Extracted the shared `TracingTransport` wrapper into its own module
  (`src/main/mcp/transports/tracing-transport.ts`) so all three
  transports consume a single implementation.

### Fixed

- Removed a stray duplicate SSE URL input that rendered in the sidebar
  regardless of the selected transport.
- Removed the 1 s polling fallback that duplicated the
  `mcpSessionMessagesStream` push stream. Protocol Inspector now relies
  on the push path end-to-end.

[0.1.2]: https://github.com/vladimirwashere/protocol-forge/releases/tag/v0.1.2
[0.1.1]: https://github.com/vladimirwashere/protocol-forge/releases/tag/v0.1.1

## [0.1.0] - 2026-04-18

First public release. Covers the Phase 1 milestone set (M1–M10).

### Added

- MCP session management over `stdio` and `sse` transports with strict
  Zod-backed input validation (absolute-path commands, URL scheme allowlist,
  bounded env/header sizes).
- Server profile CRUD persisted to local SQLite (`better-sqlite3`, WAL mode,
  foreign keys enforced).
- Discovery workflows: list tools / resources / prompts; invoke tools; read
  resources; load prompts — with structured results and latency metadata.
- Protocol Inspector with live streaming (100 ms / 50-message flush), filters
  (direction, method, search), pause/resume, and session history.
- Session history grouping with message count, error count, average latency,
  and duration summaries.
- Application menu, toast notifications for transient errors, and
  panel-level React error boundaries.
- Typed IPC contracts (`src/shared/ipc.ts`) across all 18 renderer↔main
  channels.
- Architecture and development docs (`docs/architecture.md`,
  `docs/development.md`).
- SECURITY.md with trust model and accepted v0.1.x limitations.
- CI workflow (lint + typecheck + test + non-blocking audit) and a
  tag-driven release workflow that publishes draft GitHub releases for mac,
  Windows, and Linux.

### Security

- Electron hardening: `contextIsolation: true`, `sandbox: true`,
  `nodeIntegration: false`, `webviewTag: false`, deny-by-default window
  opener, external links routed through `shell.openExternal`.
- CSP meta tag restricting `default-src` / `script-src` to `'self'`.
- macOS entitlements reduced to `com.apple.security.cs.allow-jit` only.

### Known Limitations

- Profile environment variables and SSE headers are stored in plaintext in
  the local SQLite database. Do not enter production secrets in v0.1.x.
- macOS and Windows builds are unsigned; first launch requires a Gatekeeper
  or SmartScreen override.
- No in-app auto-updater yet. Release artifacts include the `latest*.yml`
  manifests electron-updater will need for a future integration.

[0.1.0]: https://github.com/vladimirwashere/protocol-forge/releases/tag/v0.1.0
