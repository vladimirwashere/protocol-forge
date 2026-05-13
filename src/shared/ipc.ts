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
  mcpSessionMessagesStream: 'mcp-session:messages-stream',
  mcpSessionList: 'mcp-session:list',
  mcpDiscoveryListTools: 'mcp-discovery:list-tools',
  mcpDiscoveryListResources: 'mcp-discovery:list-resources',
  mcpDiscoveryListResourceTemplates: 'mcp-discovery:list-resource-templates',
  mcpDiscoveryListPrompts: 'mcp-discovery:list-prompts',
  mcpDiscoveryCallTool: 'mcp-discovery:call-tool',
  mcpDiscoveryReadResource: 'mcp-discovery:read-resource',
  mcpDiscoveryGetPrompt: 'mcp-discovery:get-prompt',
  mcpDiscoveryComplete: 'mcp-discovery:complete',
  mcpDiscoverySubscribeResource: 'mcp-discovery:subscribe-resource',
  mcpDiscoveryUnsubscribeResource: 'mcp-discovery:unsubscribe-resource',
  mcpDiscoveryResourceUpdatedStream: 'mcp-discovery:resource-updated-stream',
  mcpSamplingListPending: 'mcp-sampling:list-pending',
  mcpSamplingRespond: 'mcp-sampling:respond',
  mcpSamplingReject: 'mcp-sampling:reject',
  mcpSamplingStream: 'mcp-sampling:stream',
  mcpElicitationListPending: 'mcp-elicitation:list-pending',
  mcpElicitationRespond: 'mcp-elicitation:respond',
  mcpElicitationStream: 'mcp-elicitation:stream',
  mcpInflightList: 'mcp-inflight:list',
  mcpInflightCancel: 'mcp-inflight:cancel',
  mcpInflightStream: 'mcp-inflight:stream',
  appCheckForUpdates: 'app:check-for-updates',
  appInstallUpdate: 'app:install-update',
  appUpdateStatusStream: 'app:update-status-stream'
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

export type ProfileRoot = {
  uri: string
  name?: string
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
  roots: ProfileRoot[]
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
      roots?: ProfileRoot[]
    }
  | {
      id?: string
      name: string
      transport: 'streamable-http'
      url: string
      headers?: Record<string, string>
      roots?: ProfileRoot[]
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

export type StreamableHttpConnectInput = {
  url: string
  headers?: Record<string, string>
}

export type SessionTransport = 'stdio' | 'streamable-http'

export type SessionConnectInput =
  | {
      transport: 'stdio'
      stdio: StdioConnectInput
      profileId?: string
    }
  | {
      transport: 'streamable-http'
      streamableHttp: StreamableHttpConnectInput
      profileId?: string
    }

export type SessionConnectResponse = {
  sessionId: string
  state: SessionState
}

export type SessionDisconnectInput = {
  sessionId: string
}

export type SessionServerCapabilities = {
  completions: boolean
  resourceSubscribe: boolean
  resourceListChanged: boolean
  logging: boolean
}

export type SessionStatus = {
  sessionId: string
  state: SessionState
  transport: SessionTransport
  serverProfileId?: string
  serverProfileName?: string
  connectedAt: string
  disconnectedAt?: string
  error?: string
  messageCount: number
  errorCount: number
  avgLatencyMs?: number
  durationMs?: number
  serverCapabilities?: SessionServerCapabilities
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
  latencyMs?: number
  isError?: boolean
}

export type SessionMessagesInput = {
  sessionId: string
  limit?: number
}

export type SessionMessagesListener = (messages: SessionMessage[]) => void

export type SessionMessagesStreamInput = {
  enabled: boolean
}

export type SessionSummary = {
  sessionId: string
  state: SessionState
  transport: SessionTransport
  serverProfileId?: string
  serverProfileName?: string
  connectedAt: string
  disconnectedAt?: string
  error?: string
  messageCount: number
  errorCount: number
  avgLatencyMs?: number
  durationMs?: number
}

export type SessionListInput = {
  limit?: number
}

export type DiscoverySessionInput = {
  sessionId: string
}

export type ToolAnnotations = {
  title?: string
  readOnlyHint?: boolean
  destructiveHint?: boolean
  idempotentHint?: boolean
  openWorldHint?: boolean
}

export type ToolIcon = {
  src: string
  mimeType?: string
  sizes?: string[]
  theme?: 'light' | 'dark'
}

export type DiscoveryTool = {
  name: string
  title?: string
  description?: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  annotations?: ToolAnnotations
  icons?: ToolIcon[]
}

export type DiscoveryResource = {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

export type DiscoveryResourceTemplate = {
  uriTemplate: string
  name: string
  title?: string
  description?: string
  mimeType?: string
  icons?: ToolIcon[]
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

export type DiscoveryListResourceTemplatesResponse = {
  resourceTemplates: DiscoveryResourceTemplate[]
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
  latencyMs?: number
}

export type DiscoveryCompletionRef =
  | { type: 'ref/prompt'; name: string }
  | { type: 'ref/resource'; uri: string }

export type DiscoveryCompleteInput = {
  sessionId: string
  ref: DiscoveryCompletionRef
  argument: {
    name: string
    value: string
  }
  context?: {
    arguments?: Record<string, string>
  }
}

export type DiscoveryCompleteResult = {
  values: string[]
  total?: number
  hasMore?: boolean
}

export type DiscoveryResourceSubscriptionInput = {
  sessionId: string
  uri: string
}

export type DiscoveryResourceUpdate = {
  sessionId: string
  uri: string
  at: string
}

export type DiscoveryResourceUpdateListener = (update: DiscoveryResourceUpdate) => void

export type DiscoveryResourceUpdatedStreamInput = {
  enabled: boolean
}

export type SamplingPendingRequest = {
  requestId: string
  sessionId: string
  createdAt: string
  params: unknown
}

export type SamplingResponseContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'audio'; data: string; mimeType: string }

export type SamplingRespondInput = {
  requestId: string
  model: string
  role: 'user' | 'assistant'
  content: SamplingResponseContent
  stopReason?: string
}

export type SamplingRejectInput = {
  requestId: string
  message: string
  code?: number
}

export type SamplingListPendingInput = Record<string, never>

export type SamplingStreamInput = {
  enabled: boolean
}

export type SamplingPendingListener = (pending: SamplingPendingRequest[]) => void

export type ElicitationContentValue = string | number | boolean | string[]

export type ElicitationPendingRequest = {
  requestId: string
  sessionId: string
  createdAt: string
  mode: 'form' | 'url'
  message: string
  requestedSchema?: unknown
  elicitationId?: string
  url?: string
}

export type ElicitationRespondInput = {
  requestId: string
  action: 'accept' | 'decline' | 'cancel'
  content?: Record<string, ElicitationContentValue>
}

export type ElicitationListPendingInput = Record<string, never>

export type ElicitationStreamInput = {
  enabled: boolean
}

export type ElicitationPendingListener = (pending: ElicitationPendingRequest[]) => void

export type InflightOperationKind = 'tool' | 'resource' | 'prompt'

export type InflightOperationProgress = {
  progress: number
  total?: number
  message?: string
  at: string
}

export type InflightOperationSummary = {
  operationId: string
  sessionId: string
  kind: InflightOperationKind
  label: string
  startedAt: string
  lastProgress?: InflightOperationProgress
}

export type InflightListInput = Record<string, never>

export type InflightCancelInput = {
  operationId: string
  reason?: string
}

export type InflightStreamInput = {
  enabled: boolean
}

export type InflightOperationsListener = (operations: InflightOperationSummary[]) => void

export type UpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'not-available' }
  | { state: 'downloading'; percent: number }
  | { state: 'downloaded'; version: string }
  | { state: 'error'; message: string }

export type UpdateStatusListener = (status: UpdateStatus) => void

export type AppApi = {
  getAppMeta: () => Promise<AppMeta>
  ping: () => Promise<PingResponse>
  checkForUpdates: () => Promise<void>
  installUpdate: () => Promise<void>
  subscribeUpdateStatus: (listener: UpdateStatusListener) => () => void
  listServerProfiles: () => Promise<ServerProfile[]>
  upsertServerProfile: (input: UpsertServerProfileInput) => Promise<ServerProfile>
  deleteServerProfile: (input: DeleteServerProfileInput) => Promise<{ ok: true }>
  connectSession: (input: SessionConnectInput) => Promise<SessionConnectResponse>
  disconnectSession: (input: SessionDisconnectInput) => Promise<{ ok: true }>
  getSessionStatus: (input: SessionStatusInput) => Promise<SessionStatus>
  getSessionMessages: (input: SessionMessagesInput) => Promise<SessionMessage[]>
  subscribeSessionMessages: (listener: SessionMessagesListener) => () => void
  listSessions: (input?: SessionListInput) => Promise<SessionSummary[]>
  listTools: (input: DiscoverySessionInput) => Promise<DiscoveryListToolsResponse>
  listResources: (input: DiscoverySessionInput) => Promise<DiscoveryListResourcesResponse>
  listResourceTemplates: (
    input: DiscoverySessionInput
  ) => Promise<DiscoveryListResourceTemplatesResponse>
  listPrompts: (input: DiscoverySessionInput) => Promise<DiscoveryListPromptsResponse>
  callTool: (input: DiscoveryCallToolInput) => Promise<DiscoveryOperationResult>
  readResource: (input: DiscoveryReadResourceInput) => Promise<DiscoveryOperationResult>
  getPrompt: (input: DiscoveryGetPromptInput) => Promise<DiscoveryOperationResult>
  complete: (input: DiscoveryCompleteInput) => Promise<DiscoveryCompleteResult>
  subscribeResource: (input: DiscoveryResourceSubscriptionInput) => Promise<{ ok: true }>
  unsubscribeResource: (input: DiscoveryResourceSubscriptionInput) => Promise<{ ok: true }>
  subscribeResourceUpdates: (listener: DiscoveryResourceUpdateListener) => () => void
  listPendingSampling: () => Promise<SamplingPendingRequest[]>
  respondSampling: (input: SamplingRespondInput) => Promise<{ ok: true }>
  rejectSampling: (input: SamplingRejectInput) => Promise<{ ok: true }>
  subscribeSampling: (listener: SamplingPendingListener) => () => void
  listPendingElicitations: () => Promise<ElicitationPendingRequest[]>
  respondElicitation: (input: ElicitationRespondInput) => Promise<{ ok: true }>
  subscribeElicitations: (listener: ElicitationPendingListener) => () => void
  listInflightOperations: () => Promise<InflightOperationSummary[]>
  cancelInflightOperation: (input: InflightCancelInput) => Promise<{ ok: true }>
  subscribeInflightOperations: (listener: InflightOperationsListener) => () => void
}
