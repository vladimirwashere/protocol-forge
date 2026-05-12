import { z } from 'zod'
import type {
  DeleteServerProfileInput,
  DiscoveryCallToolInput,
  DiscoveryGetPromptInput,
  DiscoveryReadResourceInput,
  DiscoverySessionInput,
  ElicitationListPendingInput,
  ElicitationRespondInput,
  ElicitationStreamInput,
  InflightCancelInput,
  InflightListInput,
  InflightStreamInput,
  SamplingListPendingInput,
  SamplingRejectInput,
  SamplingRespondInput,
  SamplingStreamInput,
  SessionConnectInput,
  SessionDisconnectInput,
  SessionListInput,
  SessionMessagesInput,
  SessionMessagesStreamInput,
  SessionStatusInput,
  UpsertServerProfileInput
} from '../../shared/ipc'

// Compile-time guard: every schema must produce the IPC contract type exactly.
// If a contract drifts, `Equals` resolves to `false` and the assertion line fails to compile.
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
const assertEquals = <T extends true>(): T => true as T

const headersRecord = z.record(z.string(), z.string())
const envRecord = z.record(z.string(), z.string())
const promptArgsRecord = z.record(z.string(), z.string())
const unknownArgsRecord = z.record(z.string(), z.unknown())

const profileRootSchema = z.object({
  uri: z.string(),
  name: z.string().optional()
})

const stdioProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  transport: z.literal('stdio'),
  command: z.string(),
  args: z.array(z.string()),
  cwd: z.string(),
  roots: z.array(profileRootSchema).optional()
})

const streamableHttpProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  transport: z.literal('streamable-http'),
  url: z.string(),
  headers: headersRecord.optional(),
  roots: z.array(profileRootSchema).optional()
})

export const upsertServerProfileSchema = z.discriminatedUnion('transport', [
  stdioProfileSchema,
  streamableHttpProfileSchema
])
assertEquals<Equals<z.infer<typeof upsertServerProfileSchema>, UpsertServerProfileInput>>()

export const deleteServerProfileSchema = z.object({
  id: z.string()
})
assertEquals<Equals<z.infer<typeof deleteServerProfileSchema>, DeleteServerProfileInput>>()

const stdioConnectSchema = z.object({
  transport: z.literal('stdio'),
  stdio: z.object({
    command: z.string(),
    args: z.array(z.string()),
    cwd: z.string().optional(),
    env: envRecord.optional()
  }),
  profileId: z.string().optional()
})

const streamableHttpConnectSchema = z.object({
  transport: z.literal('streamable-http'),
  streamableHttp: z.object({
    url: z.string(),
    headers: headersRecord.optional()
  }),
  profileId: z.string().optional()
})

export const sessionConnectSchema = z.discriminatedUnion('transport', [
  stdioConnectSchema,
  streamableHttpConnectSchema
])
assertEquals<Equals<z.infer<typeof sessionConnectSchema>, SessionConnectInput>>()

export const sessionDisconnectSchema = z.object({
  sessionId: z.string()
})
assertEquals<Equals<z.infer<typeof sessionDisconnectSchema>, SessionDisconnectInput>>()

export const sessionStatusSchema = z.object({
  sessionId: z.string()
})
assertEquals<Equals<z.infer<typeof sessionStatusSchema>, SessionStatusInput>>()

export const sessionMessagesSchema = z.object({
  sessionId: z.string(),
  limit: z.number().int().positive().optional()
})
assertEquals<Equals<z.infer<typeof sessionMessagesSchema>, SessionMessagesInput>>()

export const sessionMessagesStreamSchema = z.object({
  enabled: z.boolean()
})
assertEquals<Equals<z.infer<typeof sessionMessagesStreamSchema>, SessionMessagesStreamInput>>()

// `.default({})` lets the renderer call `listSessions()` with no argument; raw `undefined`
// becomes `{}` before validation.
export const sessionListSchema = z
  .object({
    limit: z.number().int().positive().optional()
  })
  .default({})
assertEquals<Equals<z.infer<typeof sessionListSchema>, SessionListInput>>()

export const discoverySessionSchema = z.object({
  sessionId: z.string()
})
assertEquals<Equals<z.infer<typeof discoverySessionSchema>, DiscoverySessionInput>>()

export const discoveryCallToolSchema = z.object({
  sessionId: z.string(),
  name: z.string(),
  arguments: unknownArgsRecord.optional()
})
assertEquals<Equals<z.infer<typeof discoveryCallToolSchema>, DiscoveryCallToolInput>>()

export const discoveryReadResourceSchema = z.object({
  sessionId: z.string(),
  uri: z.string()
})
assertEquals<Equals<z.infer<typeof discoveryReadResourceSchema>, DiscoveryReadResourceInput>>()

export const discoveryGetPromptSchema = z.object({
  sessionId: z.string(),
  name: z.string(),
  arguments: promptArgsRecord.optional()
})
assertEquals<Equals<z.infer<typeof discoveryGetPromptSchema>, DiscoveryGetPromptInput>>()

// `.default({})` lets the renderer invoke without an argument (an undefined input becomes {}).
export const samplingListPendingSchema = z.object({}).strict().default({})
assertEquals<Equals<z.infer<typeof samplingListPendingSchema>, SamplingListPendingInput>>()

const samplingResponseContentSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('image'), data: z.string(), mimeType: z.string() }),
  z.object({ type: z.literal('audio'), data: z.string(), mimeType: z.string() })
])

export const samplingRespondSchema = z.object({
  requestId: z.string(),
  model: z.string(),
  role: z.enum(['user', 'assistant']),
  content: samplingResponseContentSchema,
  stopReason: z.string().optional()
})
assertEquals<Equals<z.infer<typeof samplingRespondSchema>, SamplingRespondInput>>()

export const samplingRejectSchema = z.object({
  requestId: z.string(),
  message: z.string(),
  code: z.number().int().optional()
})
assertEquals<Equals<z.infer<typeof samplingRejectSchema>, SamplingRejectInput>>()

export const samplingStreamSchema = z.object({
  enabled: z.boolean()
})
assertEquals<Equals<z.infer<typeof samplingStreamSchema>, SamplingStreamInput>>()

// `.default({})` lets the renderer invoke without an argument (an undefined input becomes {}).
export const elicitationListPendingSchema = z.object({}).strict().default({})
assertEquals<Equals<z.infer<typeof elicitationListPendingSchema>, ElicitationListPendingInput>>()

const elicitationContentValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string())
])

export const elicitationRespondSchema = z.object({
  requestId: z.string(),
  action: z.enum(['accept', 'decline', 'cancel']),
  content: z.record(z.string(), elicitationContentValueSchema).optional()
})
assertEquals<Equals<z.infer<typeof elicitationRespondSchema>, ElicitationRespondInput>>()

export const elicitationStreamSchema = z.object({
  enabled: z.boolean()
})
assertEquals<Equals<z.infer<typeof elicitationStreamSchema>, ElicitationStreamInput>>()

// `.default({})` lets the renderer invoke without an argument (an undefined input becomes {}).
export const inflightListSchema = z.object({}).strict().default({})
assertEquals<Equals<z.infer<typeof inflightListSchema>, InflightListInput>>()

export const inflightCancelSchema = z.object({
  operationId: z.string(),
  reason: z.string().optional()
})
assertEquals<Equals<z.infer<typeof inflightCancelSchema>, InflightCancelInput>>()

export const inflightStreamSchema = z.object({
  enabled: z.boolean()
})
assertEquals<Equals<z.infer<typeof inflightStreamSchema>, InflightStreamInput>>()
