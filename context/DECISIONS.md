# Protocol Forge — Architecture & Design Decisions

Decisions are final unless a milestone requires revisiting them. Do not re-litigate.

---

## Core Decisions

1. `electron-vite` for Electron build orchestration (M1).
2. `better-sqlite3` for local persistence; Electron-targeted native rebuild required (M3).
3. No formal migration runner yet; use `addColumnIfMissing` guards until schema stabilizes (deferred to M10).
4. Strict Electron isolation is non-negotiable: `contextIsolation`, `sandbox`, no renderer Node APIs (M2).
5. Typed IPC contracts in shared types + runtime validation at trust boundary (M2+).
6. Zustand for renderer state management (M6).
7. Tailwind CSS v4 for styling (M1).
8. Manual flex/drag panel resizing instead of layout libraries (M6).
9. SchemaForm scope limited to practical MCP inputs (flat objects/primitives, optional arrays) for Phase 1 (M7).
10. Manual message-list windowing over `@tanstack/react-virtual` for current scope (M8).
11. Batched push streaming is the primary protocol message path; polling remains temporary fallback (M8).
12. Anti-polish rule: stop when milestone checklist is satisfied unless user requests extras or they block next milestone.
13. M12 spec/SDK reconciliation (2026-05-12): anchor M12 implementation to MCP spec version **2025-11-25** and `@modelcontextprotocol/sdk` **1.29.0**. SDK `ClientCapabilitiesSchema` exposes five capabilities: `experimental`, `sampling` (sub-flags `context`, `tools`), `elicitation` (sub-flags `form`, `url`), `roots` (sub-flag `listChanged`), and `tasks` (newer than the PLAN.md description, with `list`, `cancel`, and `requests.{sampling.createMessage,elicitation.create}` sub-flags). M12 scope advertises `sampling`, `elicitation` (both `form` and `url`), and `roots: { listChanged: true }` only. **Deferrals**: `tasks` capability is out of scope for M12 — PLAN.md did not anticipate it and it would expand the milestone (filed as P7 below). `sampling.tools` is not advertised because the in-app sampling panel is a developer-composed mock response (no tool-execution loop); revisit when an LLM backend lands in Phase 3. `sampling.context` is soft-deprecated in 2025-11-25 and intentionally not advertised. **New surfaces to honor**: URL-mode elicitation uses `URLElicitationRequiredError` (JSON-RPC error code `-32042`) and a follow-up `notifications/elicitation/complete` from the server — the modal must close on either an in-app `accept`/`decline`/`cancel` action or the completion notification arriving for an outstanding URL elicitation. Elicitation has three response actions (`accept`/`decline`/`cancel`), not two. **Cancellation path**: M12.6 uses `notifications/cancelled` for non-task requests per the current spec; task-augmented cancellation (`tasks/cancel`) is out of scope until `tasks` is adopted. **Roots constraint**: only `file://` URIs are valid; the editor must reject other schemes before sending `notifications/roots/list_changed`.

14. M13 spec/SDK reconciliation (2026-05-12): anchor M13 implementation to the same MCP spec version **2025-11-25** and `@modelcontextprotocol/sdk` **1.29.0** baseline as decision #13.

    **Tool annotations.** `ToolAnnotationsSchema` exposes exactly five hint fields: `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`. `ToolSchema` itself adds `title` (display name override), `icons` (array of `{ src, mimeType?, sizes?, theme?: 'light'|'dark' }`), and `execution.taskSupport` (`'optional'|'required'|'forbidden'`, gated on the `tasks` capability deferred under P7). The IPC contract already plumbs `annotations` and `outputSchema` opaquely; M13 will tighten that into a typed `ToolAnnotations`-shaped projection and pick up `title` + `icons`. `execution.taskSupport` is intentionally **not** projected — it has no meaning until P7 lands. Spec is explicit that annotations are *hints from an untrusted server* and must never be load-bearing for security; the destructive-confirmation gate is a defensive UX prompt, not a trust decision.

    **Structured tool output.** `CallToolResultSchema` carries an optional `structuredContent: Record<string, unknown>`. When a tool advertises `outputSchema` and returns `structuredContent`, validate the payload against the schema (subset already supported by `SchemaForm` plus the rest of JSON Schema draft-2020-12 surface the spec calls out — leave deep `$ref` / `oneOf` resolution to M20). On validation failure: surface the diagnostic in the result panel and fall back to rendering `content`. Spec contract: `content` must still be sent by the server as a fallback even when `structuredContent` is present, so the dual render is always possible.

    **Completion.** SDK `Client.complete(params, options?)` wraps `completion/complete` and returns `{ completion: { values: string[], total?, hasMore? } }`. Request `ref` is a union of `{ type: 'ref/prompt', name }` and `{ type: 'ref/resource', uri }` (note: `ResourceReferenceSchema` is deprecated in favor of `ResourceTemplateReferenceSchema`, same shape). Spec 2025-11-25 added `params.context.arguments` so the server can produce context-aware completions based on already-filled sibling arguments — wire this through from `SchemaForm` so successive fields cascade. Gate the IPC call on `serverCapabilities.completions` being present; if absent, render the form without autocomplete rather than emitting a request that will fail.

    **Resource subscriptions.** SDK exposes `Client.subscribeResource({ uri }, options?)` / `Client.unsubscribeResource({ uri }, options?)` and the server emits `notifications/resources/updated` with `{ uri }`. Gate the subscribe UI on `serverCapabilities.resources?.subscribe === true`. Subscription state is per-session and ephemeral (do **not** persist across reconnect): if the user reconnects, they re-subscribe explicitly. On `notifications/resources/updated` for a subscribed URI, re-issue `readResource` and update the detail panel; debounce coalesces bursts. Drain all subscriptions on disconnect / shutdown / error, mirroring the inflight/elicitation drain pattern.

    **Server logging.** `LoggingLevelSchema` is a fixed enum of eight RFC 5424 levels (`debug`, `info`, `notice`, `warning`, `error`, `critical`, `alert`, `emergency`). SDK `Client.setLoggingLevel(level, options?)` wraps `logging/setLevel`. `notifications/message` carries `{ level, logger?, data }` with `data: unknown` (free-form; render as JSON when not a string). Gate the level selector on `serverCapabilities.logging` being present. Logs are session-scoped and live in a new bounded in-memory buffer in the renderer (same batched-push pattern as protocol messages); the Inspector "Logs" sub-panel filters by level. We do **not** persist log notifications in SQLite for v0.1.x — they pass through the same `MessageRecorder` that captures every protocol message, so they are already in `messages` for historical sessions; the dedicated Logs view is a renderer-side projection over the message stream filtered by `method === 'notifications/message'`.

    **Out of scope for M13** (deferred, not new backlog items): full JSON Schema validation for `structuredContent` (M20); persistent subscription state across reconnect; OAuth-protected completion/subscribe (M14); persisting log notifications in a separate `logs` table (no demand surfaced).

---

## Deferred Backlog (High Value)

Items logged here are NOT bugs. They are improvement opportunities deferred until asked or until they block progress.

| ID | Source | Item | Impact | Effort |
| ---- | -------- | ------ | -------- | -------- |
| P1 | M3 | Replace addColumnIfMissing with versioned migration runner | M | M |
| P5 | M6 | AppShell drag handle: add keyboard resize fallback | S | S |
| ~~P6~~ | ~~M8~~ | ~~Remove 1s polling loop after push stream verified~~ (done in v0.1.1) | S | S |
| P7 | M12.1 | Advertise + handle the `tasks` client capability (list/cancel + `tasks/cancel`) once a milestone drives it; PLAN.md predates this SDK 1.29 addition | M | M |
