export const IPC_CHANNELS = {
  appGetMeta: 'app:get-meta',
  appPing: 'app:ping',
  serverProfilesList: 'server-profiles:list',
  serverProfilesUpsert: 'server-profiles:upsert',
  serverProfilesDelete: 'server-profiles:delete',
  mcpSessionConnect: 'mcp-session:connect',
  mcpSessionDisconnect: 'mcp-session:disconnect',
  mcpSessionStatus: 'mcp-session:status',
  mcpSessionMessages: 'mcp-session:messages',
  mcpSessionList: 'mcp-session:list',
  mcpDiscoveryListTools: 'mcp-discovery:list-tools',
  mcpDiscoveryListResources: 'mcp-discovery:list-resources',
  mcpDiscoveryListPrompts: 'mcp-discovery:list-prompts',
  mcpDiscoveryCallTool: 'mcp-discovery:call-tool',
  mcpDiscoveryReadResource: 'mcp-discovery:read-resource',
  mcpDiscoveryGetPrompt: 'mcp-discovery:get-prompt'
} as const

export type AppMeta = {
  name: string
  version: string
  platform: NodeJS.Platform
}

export type PingResponse = {
  ok: true
  at: string
}

export type ServerProfile = {
  id: string
  name: string
  transport: SessionTransport
  command?: string
  args?: string[]
  cwd?: string
  url?: string
  headers?: Record<string, string>
  createdAt: string
  updatedAt: string
}

export type UpsertServerProfileInput =
  | {
      id?: string
      name: string
      transport: 'stdio'
      command: string
      args: string[]
      cwd: string
    }
  | {
      id?: string
      name: string
      transport: 'sse'
      url: string
      headers?: Record<string, string>
    }

export type DeleteServerProfileInput = {
  id: string
}

export type SessionState =
  | 'connecting'
  | 'initializing'
  | 'ready'
  | 'disconnecting'
  | 'disconnected'
  | 'error'

export type StdioConnectInput = {
  command: string
  args: string[]
  cwd?: string
  env?: Record<string, string>
}

export type SseConnectInput = {
  url: string
  headers?: Record<string, string>
}

export type SessionTransport = 'stdio' | 'sse'

export type SessionConnectInput =
  | {
      transport: 'stdio'
      stdio: StdioConnectInput
    }
  | {
      transport: 'sse'
      sse: SseConnectInput
    }

export type SessionConnectResponse = {
  sessionId: string
  state: SessionState
}

export type SessionDisconnectInput = {
  sessionId: string
}

export type SessionStatus = {
  sessionId: string
  state: SessionState
  transport: SessionTransport
  connectedAt: string
  disconnectedAt?: string
  error?: string
  messageCount: number
}

export type SessionStatusInput = {
  sessionId: string
}

export type SessionMessageDirection = 'outbound' | 'inbound'

export type SessionMessage = {
  id: number
  sessionId: string
  direction: SessionMessageDirection
  payload: unknown
  createdAt: string
}

export type SessionMessagesInput = {
  sessionId: string
  limit?: number
}

export type SessionSummary = {
  sessionId: string
  state: SessionState
  transport: SessionTransport
  connectedAt: string
  disconnectedAt?: string
  error?: string
  messageCount: number
}

export type SessionListInput = {
  limit?: number
}

export type DiscoverySessionInput = {
  sessionId: string
}

export type DiscoveryTool = {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  annotations?: Record<string, unknown>
}

export type DiscoveryResource = {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export type DiscoveryPromptArgument = {
  name: string
  description?: string
  required?: boolean
}

export type DiscoveryPrompt = {
  name: string
  description?: string
  arguments?: DiscoveryPromptArgument[]
}

export type DiscoveryListToolsResponse = {
  tools: DiscoveryTool[]
}

export type DiscoveryListResourcesResponse = {
  resources: DiscoveryResource[]
}

export type DiscoveryListPromptsResponse = {
  prompts: DiscoveryPrompt[]
}

export type DiscoveryCallToolInput = {
  sessionId: string
  name: string
  arguments?: Record<string, unknown>
}

export type DiscoveryReadResourceInput = {
  sessionId: string
  uri: string
}

export type DiscoveryGetPromptInput = {
  sessionId: string
  name: string
  arguments?: Record<string, string>
}

export type DiscoveryOperationResult = {
  result: unknown
}

export type AppApi = {
  getAppMeta: () => Promise<AppMeta>
  ping: () => Promise<PingResponse>
  listServerProfiles: () => Promise<ServerProfile[]>
  upsertServerProfile: (input: UpsertServerProfileInput) => Promise<ServerProfile>
  deleteServerProfile: (input: DeleteServerProfileInput) => Promise<{ ok: true }>
  connectSession: (input: SessionConnectInput) => Promise<SessionConnectResponse>
  disconnectSession: (input: SessionDisconnectInput) => Promise<{ ok: true }>
  getSessionStatus: (input: SessionStatusInput) => Promise<SessionStatus>
  getSessionMessages: (input: SessionMessagesInput) => Promise<SessionMessage[]>
  listSessions: (input?: SessionListInput) => Promise<SessionSummary[]>
  listTools: (input: DiscoverySessionInput) => Promise<DiscoveryListToolsResponse>
  listResources: (input: DiscoverySessionInput) => Promise<DiscoveryListResourcesResponse>
  listPrompts: (input: DiscoverySessionInput) => Promise<DiscoveryListPromptsResponse>
  callTool: (input: DiscoveryCallToolInput) => Promise<DiscoveryOperationResult>
  readResource: (input: DiscoveryReadResourceInput) => Promise<DiscoveryOperationResult>
  getPrompt: (input: DiscoveryGetPromptInput) => Promise<DiscoveryOperationResult>
}
