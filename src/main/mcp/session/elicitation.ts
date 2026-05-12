import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  ElicitRequestSchema,
  ElicitationCompleteNotificationSchema,
  type ElicitResult
} from '@modelcontextprotocol/sdk/types.js'

import type {
  ElicitationContentValue,
  ElicitationPendingRequest,
  ElicitationRespondInput
} from '../../../shared/ipc'

export type PendingElicitationEntry = {
  requestId: string
  sessionId: string
  createdAt: string
  mode: 'form' | 'url'
  message: string
  requestedSchema?: unknown
  elicitationId?: string
  url?: string
  resolve: (result: ElicitResult) => void
  reject: (error: Error) => void
}

type StoreListener = () => void

export class PendingElicitationStore {
  private readonly entries = new Map<string, PendingElicitationEntry>()
  private readonly listeners = new Set<StoreListener>()

  add(entry: PendingElicitationEntry): void {
    if (this.entries.has(entry.requestId)) {
      throw new Error(`Duplicate elicitation requestId ${entry.requestId}`)
    }
    this.entries.set(entry.requestId, entry)
    this.emit()
  }

  get(requestId: string): PendingElicitationEntry | undefined {
    return this.entries.get(requestId)
  }

  respond(input: ElicitationRespondInput): boolean {
    const entry = this.entries.get(input.requestId)
    if (!entry) return false
    this.entries.delete(input.requestId)
    entry.resolve(buildElicitResult(input.action, input.content))
    this.emit()
    return true
  }

  rejectBySession(sessionId: string, error: Error): void {
    let changed = false
    for (const entry of [...this.entries.values()]) {
      if (entry.sessionId === sessionId) {
        this.entries.delete(entry.requestId)
        entry.reject(error)
        changed = true
      }
    }
    if (changed) this.emit()
  }

  // Completion notifications close the loop for URL-mode flows; the server may send them
  // after we already resolved the matching request, so a no-op miss is expected.
  completeByElicitationId(sessionId: string, elicitationId: string): boolean {
    for (const entry of [...this.entries.values()]) {
      if (entry.sessionId === sessionId && entry.elicitationId === elicitationId) {
        this.entries.delete(entry.requestId)
        entry.resolve({ action: 'accept' })
        this.emit()
        return true
      }
    }
    return false
  }

  list(): ElicitationPendingRequest[] {
    return [...this.entries.values()].map((entry) => projectEntry(entry))
  }

  size(): number {
    return this.entries.size
  }

  onChange(listener: StoreListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

function projectEntry(entry: PendingElicitationEntry): ElicitationPendingRequest {
  const base: ElicitationPendingRequest = {
    requestId: entry.requestId,
    sessionId: entry.sessionId,
    createdAt: entry.createdAt,
    mode: entry.mode,
    message: entry.message
  }
  if (entry.requestedSchema !== undefined) base.requestedSchema = entry.requestedSchema
  if (entry.elicitationId !== undefined) base.elicitationId = entry.elicitationId
  if (entry.url !== undefined) base.url = entry.url
  return base
}

function buildElicitResult(
  action: ElicitationRespondInput['action'],
  content?: Record<string, ElicitationContentValue>
): ElicitResult {
  if (action === 'accept' && content !== undefined) {
    return { action, content } as ElicitResult
  }
  return { action } as ElicitResult
}

export type ElicitationIdGenerator = () => string

export function registerElicitationHandler(
  client: Client,
  sessionId: string,
  store: PendingElicitationStore,
  generateId: ElicitationIdGenerator
): void {
  client.setRequestHandler(ElicitRequestSchema, (request) => {
    return new Promise<ElicitResult>((resolve, reject) => {
      const params = request.params
      const requestId = generateId()
      const createdAt = new Date().toISOString()
      const mode = params.mode === 'url' ? 'url' : 'form'

      if (mode === 'url') {
        store.add({
          requestId,
          sessionId,
          createdAt,
          mode: 'url',
          message: params.message,
          elicitationId: (params as { elicitationId: string }).elicitationId,
          url: (params as { url: string }).url,
          resolve,
          reject
        })
      } else {
        store.add({
          requestId,
          sessionId,
          createdAt,
          mode: 'form',
          message: params.message,
          requestedSchema: (params as { requestedSchema: unknown }).requestedSchema,
          resolve,
          reject
        })
      }
    })
  })

  client.setNotificationHandler(ElicitationCompleteNotificationSchema, (notification) => {
    store.completeByElicitationId(sessionId, notification.params.elicitationId)
  })
}
