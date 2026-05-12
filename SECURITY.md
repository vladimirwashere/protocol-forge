# Security Policy

## Trust Model

Protocol Forge enforces the standard Electron trust boundaries documented in
[docs/architecture.md](docs/architecture.md#security-boundaries):

- **Main process** is privileged. It owns window lifecycle, IPC, SQLite
  persistence, and MCP session orchestration.
- **Renderer process** is untrusted UI. It runs with `contextIsolation: true`,
  `sandbox: true`, `nodeIntegration: false`, and no `webviewTag`. It reaches the
  main process only through the typed bridge in `src/shared/ipc.ts`.
- **User-configured MCP servers** (stdio commands or Streamable HTTP
  endpoints) are untrusted. Their responses are rendered
  defensively. Stdio commands are spawned with validated, bounded
  arguments — never through a shell. Stdio child processes inherit only
  the MCP SDK's default env allowlist (`PATH`, `HOME`, `USER`, platform
  equivalents); user-supplied env entries in the profile are layered on
  top of that allowlist.

## Client Capabilities Advertised to Servers

Protocol Forge advertises a fixed, audited set of MCP client capabilities
on every connection: `sampling`, `elicitation` (`form` + `url` modes),
and `roots` with `listChanged`. The deferred capabilities (`tasks`,
`sampling.tools`, `sampling.context`) are intentionally not advertised.

**Roots disclosure.** A connected server may call `roots/list` and
receive back the `file://` URIs the user has configured on the active
session's profile. Only `file://` URIs are accepted at the trust
boundary (rejected at the renderer, the IPC schema, and the persistence
repo). Roots are user-curated per profile and the server only sees the
roots associated with the profile that authorized the session.

**Sampling.** Servers may call `sampling/createMessage`. Protocol Forge
parks each request in an in-memory store and surfaces it in a renderer
panel where the developer composes a mock response by hand — no LLM is
contacted, and no server input is ever fed to a model on the user's
behalf. Pending requests are scoped to the originating session and
auto-rejected on disconnect/error so promises never leak across
sessions.

**Cancellation.** Tool/resource/prompt invocations are tracked per
session with an `AbortController`. The user can cancel any in-flight
operation from the inspector panel; cancellation aborts the SDK request
and emits `notifications/cancelled` on the transport so the server can
release work it had started. When a session disconnects or errors, all
of its still-pending in-flight controllers are aborted automatically.

**Elicitation.** Servers may call `elicitation/create` in either `form`
or `url` mode. Form-mode requests render a constrained-schema input
panel; the user's response is sent back as the
`{ action: 'accept'|'decline'|'cancel', content? }` result with no
processing. URL-mode requests show the destination URL to the user and
only navigate via `shell.openExternal` after an explicit Accept click
— the renderer never receives shell access, the open call is performed
in main against the URL stored alongside the pending entry, and Decline
or Cancel never opens the browser. The matching
`notifications/elicitation/complete` notification resolves any
still-pending URL entry. Pending elicitations are session-scoped and
drained on disconnect/error like sampling.

## Data at Rest

Protocol Forge persists state in a local SQLite database
(`protocol-forge.db` in Electron `userData`).

- **Streamable HTTP request headers** are encrypted via Electron
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
