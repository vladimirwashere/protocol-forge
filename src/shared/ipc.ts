export const IPC_CHANNELS = {
  appGetMeta: 'app:get-meta',
  appPing: 'app:ping',
  serverProfilesList: 'server-profiles:list',
  serverProfilesUpsert: 'server-profiles:upsert',
  serverProfilesDelete: 'server-profiles:delete',
  mcpSessionConnect: 'mcp-session:connect',
  mcpSessionDisconnect: 'mcp-session:disconnect',
  mcpSessionStatus: 'mcp-session:status',
  mcpSessionMessages: 'mcp-session:messages'
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
  command: string
  args: string[]
  cwd: string
  createdAt: string
  updatedAt: string
}

export type UpsertServerProfileInput = {
  id?: string
  name: string
  command: string
  args: string[]
  cwd: string
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

export type SessionConnectInput = {
  transport: 'stdio'
  stdio: StdioConnectInput
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
  transport: 'stdio'
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
}
