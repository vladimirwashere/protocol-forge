# Protocol Forge

Desktop-first MCP operations console for engineering teams that need reliable protocol visibility, repeatable invocation workflows, and production-grade debugging ergonomics.

## What It Does

- Connect to MCP servers over `stdio`, `sse`, and `streamable-http`.
- Save and reuse server profiles (request headers for `sse` and `streamable-http` are encrypted at rest via the OS keystore).
- Discover tools, resources, and prompts for the active session.
- Invoke tools and inspect results with latency metadata.
- Inspect live protocol traffic with filters, search, pause/resume, and history.
- Persist profiles, sessions, and messages in local SQLite storage.

## Installing a Release

Download the installer for your platform from the
[Releases page](https://github.com/vladimirwashere/protocol-forge/releases).

v0.1.x builds are **unsigned**, so the OS will block them on first launch.

- **macOS**: after copying `Protocol Forge.app` to `/Applications`, clear the
  quarantine flag once:

  ```bash
  xattr -dr com.apple.quarantine "/Applications/Protocol Forge.app"
  ```

  Or right-click the app, choose Open, and confirm the Gatekeeper prompt.
- **Windows**: SmartScreen will show "Windows protected your PC". Click
  "More info" then "Run anyway".
- **Linux**: run the `.AppImage` directly, or install the `.deb` / `.snap`.

Protocol Forge checks for new releases on launch and surfaces an in-app
notification when an update is downloaded, so subsequent releases reach
you without a manual download.

See [SECURITY.md](SECURITY.md) for the trust model and current limitations.

## Tech Stack

- Electron 39
- React 19 + TypeScript (strict)
- Zustand for renderer state
- SQLite via `better-sqlite3`
- MCP SDK (`@modelcontextprotocol/sdk`)
- Vitest + ESLint + Prettier

## Prerequisites

- Node.js 22+
- pnpm 10+

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Run in development

```bash
pnpm dev
```

### 3. Run quality checks

```bash
pnpm lint
pnpm typecheck
pnpm test --run
```

### 4. Build production bundles

```bash
pnpm build
```

## Packaging

```bash
pnpm build:unpack
pnpm build:mac
pnpm build:win
pnpm build:linux
```

## Typical User Workflow

1. Create a server profile in the sidebar (`stdio`, `sse`, or `streamable-http`).
2. Connect the profile and wait for session state `ready`.
3. Open Discovery and load tools/resources/prompts.
4. Invoke a tool or read a resource/prompt.
5. Use Protocol Inspector to trace request/response traffic and latency.
6. Review past sessions from the history section.

## Connection Examples

### Stdio profile

```text
transport: stdio
command: npx
args: @modelcontextprotocol/server-everything
cwd: <optional working directory>

Note: profile fields also accept labeled input (for example `command: npx`, `args: ...`). Labels are sanitized on save.
```

### SSE profile

```text
transport: sse
url: https://example.com/mcp/sse
headers: optional key/value headers

Note: `url:` labels are sanitized on save.
```

### Streamable HTTP profile

```text
transport: streamable-http
url: https://example.com/mcp
headers: optional key/value headers
```

The MCP specification deprecated SSE on 2025-03-26 in favor of Streamable
HTTP. Prefer Streamable HTTP against any server that supports it.

## Debugging and Operations

### Where data is stored

Protocol Forge stores local data in a SQLite database named `protocol-forge.db` inside Electron `userData`.

- macOS: `~/Library/Application Support/protocol-forge/protocol-forge.db`
- Linux: `~/.config/protocol-forge/protocol-forge.db`
- Windows: `%APPDATA%/protocol-forge/protocol-forge.db`

### Common failure patterns

- `stdio` connection fails: verify command/args/cwd, and ensure the MCP server binary can be launched from that context. Spawned servers inherit only the MCP SDK's default env allowlist (`PATH`, `HOME`, `USER`, platform equivalents); if your server needs other host env vars, add them to the profile's env.
- `sse` / `streamable-http` connection fails: verify URL scheme is `http` or `https`, endpoint path, and auth headers.
- Discovery is empty: ensure the session is `ready` before listing capabilities.

### Runtime inspection tips

- Use Protocol Inspector filters (`direction`, `method`, `search`) to isolate failures quickly.
- Review recent sessions in history to compare successful vs failing runs.
- Use latency metadata to identify slow MCP operations.

## Security Model

- Strict Electron isolation: `contextIsolation` + `sandbox` + no renderer Node integration.
- Typed IPC contracts validate trust boundaries in the main process.
- External server data is treated as untrusted.
- Request headers for `sse` and `streamable-http` profiles are encrypted at
  rest via the OS keystore (Keychain on macOS, DPAPI on Windows, libsecret
  on Linux). On Linux hosts without a libsecret-compatible keyring,
  Protocol Forge logs a warning and falls back to plaintext storage.
- Spawned `stdio` servers inherit only the MCP SDK's default env allowlist;
  arbitrary host env vars are not leaked into child processes.

See [SECURITY.md](SECURITY.md) for the full policy.

## Documentation Index

- [docs/development.md](docs/development.md): setup, scripts, validation, troubleshooting, release process.
- [docs/architecture.md](docs/architecture.md): process model, data flow, security boundaries, limitations.
- [SECURITY.md](SECURITY.md): trust model, accepted limitations, vulnerability disclosure.
- [CHANGELOG.md](CHANGELOG.md): release history.

## Project Status

Phase 1 milestone set (M1-M10) is complete, including:

- Discovery and invocation workflows
- Protocol inspector streaming and session history
- Error UX improvements (toasts + panel-level error boundaries)
- App menu and baseline architecture/development docs
