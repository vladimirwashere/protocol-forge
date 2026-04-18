# Changelog

All notable changes to Protocol Forge are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
