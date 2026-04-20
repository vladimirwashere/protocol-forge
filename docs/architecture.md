# Protocol Forge Architecture

## Overview

Protocol Forge is a desktop Electron app for inspecting and testing MCP servers over `stdio`, `SSE`, and `Streamable HTTP` transports.

Runtime is split across the standard Electron trust boundaries:

- Main process: privileged runtime for window lifecycle, IPC handlers, session orchestration, and persistence.
- Preload process: narrow typed bridge exposing a safe `window.api` contract to the renderer.
- Renderer process: React UI, state stores, and user interactions with no direct Node.js access.

Design priorities:

1. Correctness of protocol/session behavior.
2. Security across process trust boundaries.
3. Maintainability of typed contracts and modular layers.
4. UX polish after core behavior is stable.

## Process Model

### Main (`src/main`)

Responsibilities:

- Build secure BrowserWindow options (`contextIsolation`, `sandbox`, no `nodeIntegration`, no `webviewTag`).
- Register IPC handlers for app metadata, profile CRUD, session lifecycle, discovery operations, and message streaming.
- Orchestrate MCP sessions through the session manager and transport factory.
- Persist profiles, sessions, and protocol messages via SQLite repositories.
- Configure the application menu and shell-safe external link handling.

Key modules:

- `mcp/session-manager.ts`: session lifecycle, discovery invocation, latency/error metadata capture, message persistence.
- `mcp/transports/*`: concrete `stdio`, `sse`, and `streamable-http` transport adapters (each wrapped by a shared `TracingTransport`) plus factory selection.
- `persistence/database.ts`: SQLite initialization and schema guards.
- `persistence/*Repo.ts`: repository layer for profiles/sessions/messages.

### Preload (`src/preload`)

Responsibilities:

- Expose a minimal bridge through `contextBridge`.
- Keep renderer calls typed according to `src/shared/ipc.ts` contracts.
- Prevent arbitrary IPC channel access.

### Renderer (`src/renderer/src`)

Responsibilities:

- Present shell UI (`AppShell`) and major workflow panels.
- Manage app/session/discovery/inspector state in focused Zustand stores.
- Handle discovery invocation forms/results and protocol inspection filters.
- Surface transient failures through toasts and isolate render crashes via section error boundaries.

## Data Flow

### 1. Profile lifecycle

1. Renderer dispatches profile create/update/delete through `window.api`.
2. Main validates IPC payloads and executes repository operations.
3. Renderer refreshes profile list and updates sidebar state.

### 2. Session lifecycle

1. Renderer requests connect (`stdio`, `sse`, or `streamable-http`) for a profile.
2. Main delegates to session manager, which initializes transport and MCP client.
3. Session state transitions are persisted and exposed via status/list IPC.
4. Disconnect/shutdown closes active transport and records terminal state.

### 3. Discovery and invocation

1. Renderer lists tools/resources/prompts from an active ready session.
2. User invokes tool/reads resource/loads prompt via discovery IPC.
3. Session manager captures timing and error metadata.
4. Renderer displays structured result and latency details.

### 4. Protocol inspector stream

1. Session manager emits captured protocol messages.
2. Main batches messages (100ms / 50-message flush) and pushes to subscribed renderers.
3. Renderer stores maintain bounded in-memory buffers for responsive filtering/inspection.
4. Full historical data remains in SQLite for session history loading.

## Security Boundaries

- Renderer has no direct access to Node.js runtime or filesystem.
- Every IPC payload crossing into main is validated against shared Zod-backed contracts.
- External data from MCP servers is treated as untrusted and rendered defensively.
- External URL opening is routed through `shell.openExternal` with deny-by-default window open behavior.

## Session and Message Lifecycle Summary

1. Session records are created on connect attempts.
2. Runtime session state transitions are mirrored into persistence.
3. Every traced protocol message is persisted and optionally streamed to renderer subscribers.
4. Session summary metrics (`messageCount`, `errorCount`, `avgLatencyMs`, `durationMs`) are derived from persisted data.

## Error and Resilience Strategy

- Transport and discovery failures propagate as user-facing error messages.
- Toasts provide transient error feedback without interrupting workflow.
- Panel-level error boundaries prevent a single React subtree failure from crashing the entire app view.
- Session/message persistence preserves historical debugging context after failures.

## Known Limitations (Phase 1)

- SchemaForm intentionally supports a practical JSON Schema subset (flat objects, primitives, optional arrays).
- Message list uses manual windowing rather than a full virtualizer dependency.
- SQLite schema evolution still uses `addColumnIfMissing` guards instead of formal versioned migrations.
- Streamable HTTP session resumption (sessionId + last-event-id) is not yet implemented; every connect creates a new MCP session.

## Tradeoffs

- Manual inspector windowing was chosen to minimize dependencies during Phase 1.
- Schema-driven forms intentionally implement a scoped JSON Schema subset to avoid unreliable edge-case behavior.

## Phase 2 Recommendations

1. Replace schema guards with a versioned migration runner and migration table.
2. Expand JSON Schema form support and validation UX.
3. Add richer diagnostics/export flows for sessions and protocol traces.
4. Add deeper accessibility and keyboard support for panel resizing and inspector navigation.
5. Streamable HTTP session resumption: persist `sessionId` and last event id
   per profile to resume interrupted sessions without starting over.
6. Extract the MCP session core (`src/main/mcp/*`) into a workspace package so
   both the Electron app and a future scriptable CLI (`protocol-forge call`,
   `protocol-forge inspect`) can import the same validated transports and
   session logic. Target use cases: MCP server smoke tests in CI, quick
   terminal-only capability probes.
