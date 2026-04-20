# Security Policy

## Trust Model

Protocol Forge enforces the standard Electron trust boundaries documented in
[docs/architecture.md](docs/architecture.md#security-boundaries):

- **Main process** is privileged. It owns window lifecycle, IPC, SQLite
  persistence, and MCP session orchestration.
- **Renderer process** is untrusted UI. It runs with `contextIsolation: true`,
  `sandbox: true`, `nodeIntegration: false`, and no `webviewTag`. It reaches the
  main process only through the typed bridge in `src/shared/ipc.ts`.
- **User-configured MCP servers** (stdio commands, SSE endpoints, or
  Streamable HTTP endpoints) are untrusted. Their responses are rendered
  defensively. Stdio commands are spawned with validated, bounded
  arguments — never through a shell. Stdio child processes inherit only
  the MCP SDK's default env allowlist (`PATH`, `HOME`, `USER`, platform
  equivalents); user-supplied env entries in the profile are layered on
  top of that allowlist.

## Data at Rest

Protocol Forge persists state in a local SQLite database
(`protocol-forge.db` in Electron `userData`).

- **SSE and Streamable HTTP request headers** are encrypted via Electron
  `safeStorage`, which delegates to the OS keystore (Keychain on macOS,
  DPAPI on Windows, libsecret on Linux). Existing plaintext rows from
  earlier versions are migrated in place on first launch of v0.1.1.
- **On Linux hosts without a libsecret-compatible keyring**,
  `safeStorage.isEncryptionAvailable()` returns false. Protocol Forge
  logs a one-time warning at startup and falls back to plaintext. If
  your Linux host lacks libsecret, treat profile headers as plaintext
  at rest.
- Stdio profile env vars are transient — they are only persisted as part
  of the runtime session record (for history/debugging) and never stored
  on `server_profiles` rows.

## Known Limitations in v0.1.x

These are accepted limitations for the current release.

- **Builds are unsigned** on macOS and Windows. Gatekeeper and SmartScreen
  will warn on first launch. Users must explicitly allow the app. See
  README for per-platform install instructions.

## Reporting a Vulnerability

Please report security issues privately via GitHub Security Advisories on this
repository. Do not open a public issue for suspected vulnerabilities.

Include steps to reproduce, affected version, and your assessment of impact.
You should receive an acknowledgement within a few business days.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
