# MCP Scope — Architecture & Design Decisions

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

---

## Deferred Backlog (High Value)

Items logged here are NOT bugs. They are improvement opportunities deferred until asked or until they block progress.

| ID | Source | Item | Impact | Effort |
| ---- | -------- | ------ | -------- | -------- |
| P1 | M3 | Replace addColumnIfMissing with versioned migration runner | M | M |
| P5 | M6 | AppShell drag handle: add keyboard resize fallback | S | S |
| P6 | M8 | Remove 1s polling loop after push stream verified | S | S |
| P11 | M10 | Implement app menu with Electron Menu API (File, Edit, View, Help) | M | M |
| P12 | M10 | Add React error boundaries around major UI sections (AppShell, DiscoveryPanel, ProtocolInspector) | M | M |
| P13 | M10 | Add toast/notification system for user feedback (success, error, info) | M | M |
