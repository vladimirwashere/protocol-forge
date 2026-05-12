import type { InflightOperationProgress, InflightOperationSummary } from '../../../shared/ipc'

export type InflightOperationKind = 'tool' | 'resource' | 'prompt'

export type InflightOperationEntry = {
  operationId: string
  sessionId: string
  kind: InflightOperationKind
  label: string
  startedAt: string
  lastProgress?: InflightOperationProgress
  controller: AbortController
}

export type StartInflightOperationInput = {
  operationId: string
  sessionId: string
  kind: InflightOperationKind
  label: string
  controller: AbortController
}

type StoreListener = () => void

export class InflightOperationsStore {
  private readonly entries = new Map<string, InflightOperationEntry>()
  private readonly listeners = new Set<StoreListener>()

  start(input: StartInflightOperationInput): InflightOperationEntry {
    if (this.entries.has(input.operationId)) {
      throw new Error(`Duplicate inflight operationId ${input.operationId}`)
    }
    const entry: InflightOperationEntry = {
      operationId: input.operationId,
      sessionId: input.sessionId,
      kind: input.kind,
      label: input.label,
      startedAt: new Date().toISOString(),
      controller: input.controller
    }
    this.entries.set(entry.operationId, entry)
    this.emit()
    return entry
  }

  recordProgress(operationId: string, progress: InflightOperationProgress): boolean {
    const entry = this.entries.get(operationId)
    if (!entry) return false
    entry.lastProgress = progress
    this.emit()
    return true
  }

  complete(operationId: string): boolean {
    if (!this.entries.delete(operationId)) return false
    this.emit()
    return true
  }

  // Aborts the controller and removes the entry. SDK auto-emits notifications/cancelled
  // when the abort surfaces during a pending request, so the server is informed.
  cancel(operationId: string, reason?: string): boolean {
    const entry = this.entries.get(operationId)
    if (!entry) return false
    this.entries.delete(operationId)
    entry.controller.abort(reason ?? 'Cancelled by user')
    this.emit()
    return true
  }

  rejectBySession(sessionId: string, reason: string): void {
    let changed = false
    for (const entry of [...this.entries.values()]) {
      if (entry.sessionId === sessionId) {
        this.entries.delete(entry.operationId)
        entry.controller.abort(reason)
        changed = true
      }
    }
    if (changed) this.emit()
  }

  get(operationId: string): InflightOperationEntry | undefined {
    return this.entries.get(operationId)
  }

  list(): InflightOperationSummary[] {
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

function projectEntry(entry: InflightOperationEntry): InflightOperationSummary {
  const base: InflightOperationSummary = {
    operationId: entry.operationId,
    sessionId: entry.sessionId,
    kind: entry.kind,
    label: entry.label,
    startedAt: entry.startedAt
  }
  if (entry.lastProgress !== undefined) base.lastProgress = entry.lastProgress
  return base
}
