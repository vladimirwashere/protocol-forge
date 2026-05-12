import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js'

/**
 * Capabilities advertised on every outbound `new Client(...)`.
 *
 * Scope is anchored to MCP spec 2025-11-25 + SDK 1.29 (decision #13 in
 * `context/DECISIONS.md`). `sampling.tools`, `sampling.context`, and the
 * `tasks` capability are intentionally omitted — see DECISIONS for the
 * deferral rationale.
 */
export const CLIENT_CAPABILITIES: ClientCapabilities = {
  sampling: {},
  elicitation: {
    form: {},
    url: {}
  },
  roots: {
    listChanged: true
  }
}
