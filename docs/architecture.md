# Protocol Forge Architecture

## Overview

Protocol Forge is a desktop Electron app for inspecting and testing MCP servers over `stdio` and `Streamable HTTP` transports.

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

- `mcp/session-manager.ts`: session lifecycle, discovery invocation, latency/error metadata capture, message persistence, and the cross-session `PendingSamplingStore` (server-initiated `sampling/createMessage` requests parked until the developer responds via the renderer).
- `mcp/session/sampling.ts`: in-memory pending-request store and `CreateMessageRequestSchema` handler registration; pending entries scoped by session id and drained on disconnect/error.
- `mcp/session/elicitation.ts`: in-memory pending-request store, `ElicitRequestSchema` handler, and `ElicitationCompleteNotificationSchema` handler for URL-mode completion. URL-mode `accept` actions route through a `SessionManager`-injected `shell.openExternal` opener; non-accept actions and form mode never touch the shell.
- `mcp/session/inflight.ts`: in-memory store of running tool/resource/prompt invocations keyed by generated `operationId`, each entry carrying an `AbortController`. `SessionManager.runTracked` allocates an entry per discovery call, forwards `signal` + `onprogress` into the SDK's `RequestOptions`, removes the entry in `finally`, and exposes a `cancelInflightOperation` method that calls `controller.abort()` (the SDK then auto-emits `notifications/cancelled` on the wire).
- `mcp/session/resource-subscriptions.ts`: in-memory `ResourceSubscriptionsStore` (Set keyed by `${sessionId}::${uri}`) tracking which resources each session has actively subscribed to, plus a `ResourceUpdatedNotificationSchema` handler that filters incoming `notifications/resources/updated` against the current subscription state before fanning out — late events arriving after the user unsubscribes are dropped. `SessionManager.subscribeResource`/`unsubscribeResource` gate on `serverCapabilities.resources.subscribe` (throwing `RESOURCE_SUBSCRIBE_NOT_SUPPORTED`), use `try/finally` so local tracking always clears on unsubscribe, and drain the store via `removeBySession` on disconnect/shutdown/error.
- `mcp/session/logging.ts`: `LogNotificationsBus` (single fan-out emitter shared across sessions) plus a `LoggingMessageNotificationSchema` handler that projects each `notifications/message` defensively — drops notifications whose `level` is not in the fixed RFC 5424 enum, includes `logger` only when present and a string, stamps an `at` timestamp on emit. `SessionManager.setLoggingLevel` gates on `serverCapabilities.logging` (throws `LOGGING_NOT_SUPPORTED`) before forwarding to `Client.setLoggingLevel`. Renderer-side, log notifications flow through the dedicated `mcp-logging:stream` channel into a bounded 300-entry per-session buffer in `useLoggingStore`; the Inspector `LogsPanel` provides a server-level selector, a local minimum-severity filter, and level-colored entries (JSON-pretty-printed when `data` is not a string).
- `mcp/session/status.ts`: projects `SessionStatus` from runtime/persisted state. Defensively reads `Client.getServerCapabilities()` and emits a typed `serverCapabilities` bag (`completions`, `resourceSubscribe`, `resourceListChanged`, `logging`) so the renderer can gate feature affordances on what the server advertised at initialize.
- `mcp/session/discovery.ts`: pure functions over the MCP `Client` for tools/resources/resource-templates/prompts plus `complete()` (forwards `completion/complete` requests, projects `total`/`hasMore`). Resource templates are projected defensively — entries without string `uriTemplate`/`name` are dropped, wrong-typed optionals are stripped, icons reuse the same projector as tools. `SessionManager.complete` gates the call on the server's `completions` capability and throws `COMPLETIONS_NOT_SUPPORTED` if absent.
- `mcp/transports/*`: concrete `stdio` and `streamable-http` transport adapters (each wrapped by a shared `TracingTransport`) plus factory selection.
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

1. Renderer requests connect (`stdio` or `streamable-http`) for a profile.
2. Main delegates to session manager, which initializes transport and MCP client.
3. Session state transitions are persisted and exposed via status/list IPC.
4. Disconnect/shutdown closes active transport and records terminal state.

### 3. Discovery and invocation

1. Renderer lists tools/resources/prompts from an active ready session.
2. User invokes tool/reads resource/loads prompt via discovery IPC.
3. Session manager captures timing and error metadata.
4. Renderer displays structured result and latency details.

### 4. Server-initiated sampling

1. Server calls `sampling/createMessage` over an active session.
2. Session manager's handler creates a pending entry keyed by a generated request id and returns a deferred promise to the SDK.
3. Main pushes the updated pending list to renderer subscribers; the renderer's `SamplingPanel` surfaces the request and a compose form.
4. Developer responds (text/image/audio content) or declines; main resolves/rejects the deferred promise so the SDK delivers the JSON-RPC response. No LLM backend is integrated — responses are manually composed.

### 5. Server-initiated elicitation

1. Server calls `elicitation/create` (form or URL mode) over an active session.
2. Session manager's handler creates a pending entry keyed by a generated request id and returns a deferred promise to the SDK.
3. Main pushes the updated pending list to renderer subscribers; the renderer's `ElicitationModal` shows the head-of-queue request (form fields or URL prompt).
4. Developer accepts/declines/cancels. For URL-mode `accept`, main calls `shell.openExternal` against the stored URL before resolving the promise. Form-mode `accept` delivers the user's responses as the result `content`.
5. For URL-mode requests, the server may also send `notifications/elicitation/complete`, which closes any still-pending entry with `{ action: 'accept' }`.

### 6. In-flight operation tracking, progress, and cancellation

1. Renderer invokes a tool/resource/prompt over an active ready session.
2. `SessionManager.runTracked` allocates a fresh `operationId` + `AbortController`, registers an entry in `InflightOperationsStore`, and forwards the controller's signal plus a progress callback into the SDK call via `RequestOptions.signal` and `RequestOptions.onprogress`.
3. Incoming `notifications/progress` from the server trigger the `onprogress` callback, which records `{ progress, total?, message?, at }` on the entry and broadcasts the updated operation list to subscribed renderers.
4. When the call resolves or rejects, the entry is removed in `finally`. If the renderer calls `cancelInflightOperation`, the store aborts the controller — the SDK raises `AbortError` from the pending `request()` and emits `notifications/cancelled` on the transport so the server can stop work.
5. Inflight entries scoped to a session are drained (with their controllers aborted) on disconnect, shutdown, or session error.

### 7. Resource subscriptions

1. Renderer toggles a subscription on a resource entry via `subscribeResource` / `unsubscribeResource`. Both IPC handlers gate on the runtime session's advertised `serverCapabilities.resources.subscribe` and throw `RESOURCE_SUBSCRIBE_NOT_SUPPORTED` otherwise.
2. `SessionManager` forwards to the SDK (`Client.subscribeResource` / `unsubscribeResource`) and mirrors the result into `ResourceSubscriptionsStore` so the main process knows what each session is actively watching. Unsubscribe uses `try/finally` to drop local tracking even if the server errors.
3. The store's `ResourceUpdatedNotificationSchema` handler filters incoming `notifications/resources/updated` against the current subscription set before broadcasting `{ sessionId, uri, at }` to renderer subscribers — late events after unsubscribe are dropped.
4. Renderer's `useResourceSubscriptionsStore` (Zustand) tracks `{ pending, lastUpdateAt }` per `(sessionId, uri)`. Incoming updates refresh `lastUpdateAt` only when the URI is still in the map; `App.tsx` auto-refetches the resource only when the user is actively viewing it (`activeResultTitle === Resource: ${uri}`).
5. Subscriptions are session-scoped: drained from both stores on disconnect/shutdown/error in main and cleared from the renderer store on sessionId change.

### 8. Protocol inspector stream

1. Session manager emits captured protocol messages.
2. Main batches messages (100ms / 50-message flush) and pushes to subscribed renderers.
3. Renderer stores maintain bounded in-memory buffers for responsive filtering/inspection.
4. Full historical data remains in SQLite for session history loading.

### 9. Server logging

1. Each `new Client(...)` registers a `LoggingMessageNotificationSchema` handler that fans `notifications/message` into a shared `LogNotificationsBus`. Notifications whose `level` falls outside the fixed RFC 5424 enum are dropped at the boundary.
2. Main broadcasts each emitted `LogNotification` (`{sessionId, level, logger?, data, at}`) to renderer subscribers on `mcp-logging:stream`.
3. Renderer's `useLoggingStore` ingests only notifications matching the active session into a bounded 300-entry buffer. Switching sessions resets the buffer.
4. `setLoggingLevel` is gated on `serverCapabilities.logging`; the Inspector `LogsPanel` exposes a server-level selector (calls `logging/setLevel`) alongside a renderer-side minimum-severity filter. Logs are not persisted separately — every notification still flows through `MessageRecorder`, so historical sessions can be inspected via the Protocol Inspector's full message stream.

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

## Known Limitations

- `SchemaForm` intentionally supports a practical JSON Schema subset: flat objects, primitives, and optional arrays. Deeply nested or `oneOf`/`anyOf` schemas are not rendered.
- Message list uses manual windowing rather than a full virtualizer library.
- SQLite schema evolution uses `addColumnIfMissing` guards rather than a formal versioned migration runner.
- Streamable HTTP session resumption (`sessionId` + `last-event-id`) is not yet implemented. Every connect starts a new MCP session.

## Design Tradeoffs

- Manual inspector windowing keeps the dependency surface small without sacrificing correctness for the expected message volumes.
- Schema-driven forms implement a scoped JSON Schema subset intentionally — broad schema support introduces edge-case behavior that is difficult to validate against arbitrary server definitions.

## Roadmap

Items deferred from the current release, ordered roughly by value:

1. **Versioned migration runner** — replace `addColumnIfMissing` guards with a migration table and numbered migration files.
2. **Expanded JSON Schema form support** — `oneOf`/`anyOf`, nested objects, and richer validation UX.
3. **Session and trace export** — export protocol traces or session summaries for offline analysis, bug reports, or CI integration.
4. **Streamable HTTP session resumption** — persist `sessionId` and `last-event-id` per profile so reconnects resume rather than restart.
5. **Accessibility and keyboard support** — keyboard resize for panel drag handles, full keyboard navigation in the inspector.
6. **Scriptable CLI** — extract `src/main/mcp/*` into a workspace package shared by the Electron app and a future `protocol-forge` CLI (`call`, `inspect` subcommands) for use in CI smoke tests and terminal workflows.
