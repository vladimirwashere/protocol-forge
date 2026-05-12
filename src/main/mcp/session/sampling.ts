import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  CreateMessageRequestSchema,
  type CreateMessageResult
} from '@modelcontextprotocol/sdk/types.js'

import type {
  SamplingPendingRequest,
  SamplingRejectInput,
  SamplingRespondInput
} from '../../../shared/ipc'

export type PendingSamplingEntry = {
  requestId: string
  sessionId: string
  createdAt: string
  params: unknown
  resolve: (result: CreateMessageResult) => void
  reject: (error: Error) => void
}

type StoreListener = () => void

export class PendingSamplingStore {
  private readonly entries = new Map<string, PendingSamplingEntry>()
  private readonly listeners = new Set<StoreListener>()

  add(entry: PendingSamplingEntry): void {
    if (this.entries.has(entry.requestId)) {
      throw new Error(`Duplicate sampling requestId ${entry.requestId}`)
    }
    this.entries.set(entry.requestId, entry)
    this.emit()
  }

  respond(input: SamplingRespondInput): boolean {
    const entry = this.entries.get(input.requestId)
    if (!entry) return false
    this.entries.delete(input.requestId)
    entry.resolve({
      model: input.model,
      role: input.role,
      content: input.content,
      ...(input.stopReason !== undefined ? { stopReason: input.stopReason } : {})
    } as CreateMessageResult)
    this.emit()
    return true
  }

  reject(input: SamplingRejectInput): boolean {
    const entry = this.entries.get(input.requestId)
    if (!entry) return false
    this.entries.delete(input.requestId)
    entry.reject(buildSamplingError(input.message, input.code))
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

  list(): SamplingPendingRequest[] {
    return [...this.entries.values()].map((entry) => ({
      requestId: entry.requestId,
      sessionId: entry.sessionId,
      createdAt: entry.createdAt,
      params: entry.params
    }))
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

function buildSamplingError(message: string, code?: number): Error {
  const error = new Error(message) as Error & { code?: number }
  if (code !== undefined) {
    error.code = code
  }
  return error
}

export type SamplingIdGenerator = () => string

export function registerSamplingHandler(
  client: Client,
  sessionId: string,
  store: PendingSamplingStore,
  generateId: SamplingIdGenerator
): void {
  client.setRequestHandler(CreateMessageRequestSchema, (request) => {
    return new Promise<CreateMessageResult>((resolve, reject) => {
      store.add({
        requestId: generateId(),
        sessionId,
        createdAt: new Date().toISOString(),
        params: request.params,
        resolve,
        reject
      })
    })
  })
}
