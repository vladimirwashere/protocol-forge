# Changelog

All notable changes to Protocol Forge are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

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
