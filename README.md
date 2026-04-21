# Protocol Forge

**Protocol Forge is a desktop app for connecting to, exploring, and debugging MCP (Model Context Protocol) servers.** Point it at any MCP server — local or remote — and you get a live view of its tools, resources, and prompts; a schema-driven invocation interface; and a full real-time trace of every JSON-RPC message exchanged.

It is aimed at developers who build or integrate MCP servers and need reliable visibility into protocol behavior without wiring up custom scripts for every inspection task.

---

<!-- Screenshot: full app layout showing sidebar with a connected profile, Discovery tab open with a list of tools, and the Protocol Inspector panel streaming messages at the bottom. Filename: docs/screenshots/overview.png -->

## Key Features

| Feature | Details |
|---|---|
| **Multi-transport connections** | Connect over `stdio` (local processes) or `streamable-http`. Profiles are saved and reusable. |
| **Capability discovery** | List tools, resources, and prompts for the active session in a tabbed panel. |
| **Schema-driven invocation** | Invoke tools and read resources/prompts through auto-generated forms derived from the server's JSON Schema. Results include structured output and round-trip latency. |
| **Protocol Inspector** | Stream live JSON-RPC traffic with direction/method/text filters, pause/resume, and per-message detail. |
| **Session history** | All sessions and messages are persisted locally. Replay any historical session's protocol trace from the inspector. |
| **Encrypted header storage** | `streamable-http` profile headers (auth tokens, API keys) are encrypted at rest via the OS keystore. Legacy `sse` profile headers remain encrypted on disk and can be migrated. |
| **In-app auto-update** | The app checks for new releases on launch and offers a one-click restart when an update is ready. |

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
- **Linux**: run the `.AppImage` directly, or install the `.deb`.

Protocol Forge checks for new releases on launch and surfaces an in-app
notification when an update is downloaded, so subsequent releases reach
you without a manual download.

See [SECURITY.md](SECURITY.md) for the trust model and current limitations.

## Typical Workflow

<!-- Screenshot: sidebar showing the new-profile form with transport dropdown open (stdio selected). Filename: docs/screenshots/profile-create.png -->

1. **Create a server profile** in the sidebar — choose `stdio` or `streamable-http` and fill in the command/URL.
2. **Connect** the profile and wait for session state `ready`.
3. **Open Discovery** and load tools, resources, or prompts from the server.

<!-- Screenshot: Discovery tab with a tool selected and its schema form rendered, ready to invoke. Filename: docs/screenshots/discovery-invoke.png -->

4. **Invoke a tool** or read a resource/prompt — results show structured output and latency.
5. **Use the Protocol Inspector** to trace request/response traffic in real time.

<!-- Screenshot: Protocol Inspector panel with a message selected and its full JSON payload shown in the detail pane. Filters bar visible at top. Filename: docs/screenshots/inspector-detail.png -->

6. **Review past sessions** from the history panel to compare successful vs. failing runs.

## Connection Examples

### Stdio profile

```text
transport: stdio
command:   npx
args:      @modelcontextprotocol/server-everything
cwd:       <optional working directory>
```

Spawned stdio servers inherit only the MCP SDK's default env allowlist (`PATH`, `HOME`, `USER`, and platform equivalents). If your server requires additional host env vars, add them to the profile's env field.

### Streamable HTTP profile

```text
transport: streamable-http
url:       https://example.com/mcp
headers:   Authorization: Bearer <token>
```

### Legacy SSE profiles

SSE transport creation and connection are removed. Existing saved `sse` profiles are still listed so you can convert them in-app to `streamable-http`.

## Debugging and Operations

### Where data is stored

Protocol Forge stores all data in a SQLite database (`protocol-forge.db`) inside the Electron `userData` directory:

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/protocol-forge/protocol-forge.db` |
| Linux | `~/.config/protocol-forge/protocol-forge.db` |
| Windows | `%APPDATA%\protocol-forge\protocol-forge.db` |

### Common failure patterns

- **`stdio` connection fails** — verify command/args/cwd and confirm the MCP server binary can launch from that context. If the server needs env vars not in the default allowlist, add them explicitly to the profile's env field.
- **`streamable-http` connection fails** — verify the URL scheme is `http` or `https`, the endpoint path, and any required auth headers.
- **Discovery is empty** — confirm the session state is `ready` before listing capabilities.

### Runtime inspection tips

- Use Protocol Inspector filters (`direction`, `method`, `search`) to isolate failures quickly.
- Review historical sessions to compare a working run against a failing one.
- Latency metadata on tool results and inspector messages helps identify slow MCP operations.

## Security Model

- Strict Electron isolation: `contextIsolation` + `sandbox` + no renderer Node integration.
- Every IPC payload crossing into main is validated with Zod-backed contracts.
- External server data is treated as untrusted and rendered defensively.
- Request headers for `streamable-http` profiles are encrypted at rest via the OS keystore (Keychain on macOS, DPAPI on Windows, libsecret on Linux). Legacy `sse` rows are still encrypted/migrated on read. On Linux hosts without a libsecret-compatible keyring, Protocol Forge logs a warning and falls back to plaintext.
- Spawned `stdio` servers inherit only the MCP SDK's default env allowlist — arbitrary host env vars are not leaked into child processes.

See [SECURITY.md](SECURITY.md) for the full policy.

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

```bash
pnpm install
pnpm dev
```

Quality checks:

```bash
pnpm lint
pnpm typecheck
pnpm test --run
```

Production build:

```bash
pnpm build
```

## Packaging

```bash
pnpm build:mac
pnpm build:win
pnpm build:linux
```

## Documentation Index

- [docs/development.md](docs/development.md) — setup, scripts, validation, troubleshooting, release process.
- [docs/architecture.md](docs/architecture.md) — process model, data flow, security boundaries, known limitations.
- [SECURITY.md](SECURITY.md) — trust model, accepted limitations, vulnerability disclosure.
- [CHANGELOG.md](CHANGELOG.md) — release history.
