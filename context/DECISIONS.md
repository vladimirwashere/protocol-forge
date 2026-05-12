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

---

## Deferred Backlog (High Value)

Items logged here are NOT bugs. They are improvement opportunities deferred until asked or until they block progress.

| ID | Source | Item | Impact | Effort |
| ---- | -------- | ------ | -------- | -------- |
| P1 | M3 | Replace addColumnIfMissing with versioned migration runner | M | M |
| P5 | M6 | AppShell drag handle: add keyboard resize fallback | S | S |
| ~~P6~~ | ~~M8~~ | ~~Remove 1s polling loop after push stream verified~~ (done in v0.1.1) | S | S |
| P7 | M12.1 | Advertise + handle the `tasks` client capability (list/cancel + `tasks/cancel`) once a milestone drives it; PLAN.md predates this SDK 1.29 addition | M | M |
