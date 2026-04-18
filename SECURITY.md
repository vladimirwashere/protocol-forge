# Security Policy

## Trust Model

Protocol Forge enforces the standard Electron trust boundaries documented in
[docs/architecture.md](docs/architecture.md#security-boundaries):

- **Main process** is privileged. It owns window lifecycle, IPC, SQLite
  persistence, and MCP session orchestration.
- **Renderer process** is untrusted UI. It runs with `contextIsolation: true`,
  `sandbox: true`, `nodeIntegration: false`, and no `webviewTag`. It reaches the
  main process only through the typed bridge in `src/shared/ipc.ts`.
- **User-configured MCP servers** (stdio commands or SSE endpoints) are
  untrusted. Their responses are rendered defensively. Stdio commands are
  spawned with validated, bounded arguments — never through a shell.

## Known Limitations in v0.1.x

These are accepted limitations for the initial release. All are tracked for
Phase 2.

- **Profile secrets are stored in plaintext** in the local SQLite database
  (`protocol-forge.db` in Electron `userData`). This includes stdio environment
  variables and SSE request headers. Do not enter production API tokens or
  long-lived credentials into Protocol Forge v0.1.x. Planned fix: encrypt
  sensitive fields with Electron `safeStorage` in v0.2.
- **Builds are unsigned** on macOS and Windows. Gatekeeper and SmartScreen will
  warn on first launch. Users must explicitly allow the app. See README for
  per-platform install instructions.
- **No in-app auto-updater.** Update by downloading a newer release manually.
  Release artifacts do include `latest*.yml` manifests so a future
  electron-updater integration will work without republishing.

## Reporting a Vulnerability

Please report security issues privately via GitHub Security Advisories on this
repository. Do not open a public issue for suspected vulnerabilities.

Include steps to reproduce, affected version, and your assessment of impact.
You should receive an acknowledgement within a few business days.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | ✅        |
