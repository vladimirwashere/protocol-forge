# Protocol Forge

Desktop-first MCP operations console for engineering teams that need reliable protocol visibility, repeatable invocation workflows, and production-grade debugging ergonomics.

## What It Does

- Connect to MCP servers over `stdio` and `sse`.
- Save and reuse server profiles.
- Discover tools, resources, and prompts for the active session.
- Invoke tools and inspect results with latency metadata.
- Inspect live protocol traffic with filters, search, pause/resume, and history.
- Persist profiles, sessions, and messages in local SQLite storage.

## Tech Stack

- Electron 35
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

1. Create a server profile in the sidebar (`stdio` or `sse`).
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
```

### SSE profile

```text
transport: sse
url: https://example.com/mcp/sse
headers: optional key/value headers
```

## Debugging and Operations

### Where data is stored

Protocol Forge stores local data in a SQLite database named `protocol-forge.db` inside Electron `userData`.

- macOS: `~/Library/Application Support/protocol-forge/protocol-forge.db`
- Linux: `~/.config/protocol-forge/protocol-forge.db`
- Windows: `%APPDATA%/protocol-forge/protocol-forge.db`

### Common failure patterns

- `stdio` connection fails: verify command/args/cwd, and ensure the MCP server binary can be launched from that context.
- `sse` connection fails: verify URL scheme is `http` or `https`, endpoint path, and auth headers.
- Discovery is empty: ensure the session is `ready` before listing capabilities.

### Runtime inspection tips

- Use Protocol Inspector filters (`direction`, `method`, `search`) to isolate failures quickly.
- Review recent sessions in history to compare successful vs failing runs.
- Use latency metadata to identify slow MCP operations.

## Security Model

- Strict Electron isolation: `contextIsolation` + `sandbox` + no renderer Node integration.
- Typed IPC contracts validate trust boundaries in the main process.
- External server data is treated as untrusted.

## Documentation Index

- [docs/development.md](docs/development.md): setup, scripts, validation, troubleshooting.
- [docs/architecture.md](docs/architecture.md): process model, data flow, security boundaries, limitations.

## Project Status

Phase 1 milestone set (M1-M10) is complete, including:

- Discovery and invocation workflows
- Protocol inspector streaming and session history
- Error UX improvements (toasts + panel-level error boundaries)
- App menu and baseline architecture/development docs
