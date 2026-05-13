import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { ResourceUpdatedNotificationSchema } from '@modelcontextprotocol/sdk/types.js'

import type { DiscoveryResourceUpdate } from '../../../shared/ipc'

type StoreListener = () => void
type UpdateListener = (update: DiscoveryResourceUpdate) => void

function keyOf(sessionId: string, uri: string): string {
  return `${sessionId}::${uri}`
}

export class ResourceSubscriptionsStore {
  private readonly entries = new Set<string>()
  private readonly listeners = new Set<StoreListener>()
  private readonly updateListeners = new Set<UpdateListener>()

  add(sessionId: string, uri: string): boolean {
    const key = keyOf(sessionId, uri)
    if (this.entries.has(key)) return false
    this.entries.add(key)
    this.emit()
    return true
  }

  remove(sessionId: string, uri: string): boolean {
    const key = keyOf(sessionId, uri)
    if (!this.entries.delete(key)) return false
    this.emit()
    return true
  }

  removeBySession(sessionId: string): string[] {
    const removed: string[] = []
    const prefix = `${sessionId}::`
    for (const key of [...this.entries]) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key)
        removed.push(key.slice(prefix.length))
      }
    }
    if (removed.length > 0) this.emit()
    return removed
  }

  has(sessionId: string, uri: string): boolean {
    return this.entries.has(keyOf(sessionId, uri))
  }

  listForSession(sessionId: string): string[] {
    const prefix = `${sessionId}::`
    return [...this.entries]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length))
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

  onUpdate(listener: UpdateListener): () => void {
    this.updateListeners.add(listener)
    return () => {
      this.updateListeners.delete(listener)
    }
  }

  emitUpdate(update: DiscoveryResourceUpdate): void {
    for (const listener of this.updateListeners) listener(update)
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

export function registerResourceUpdatedHandler(
  client: Client,
  sessionId: string,
  store: ResourceSubscriptionsStore
): void {
  client.setNotificationHandler(ResourceUpdatedNotificationSchema, (notification) => {
    const uri = notification.params.uri
    // The server may emit updates for resources we have already unsubscribed from due to
    // network races; only fan out updates the renderer is still watching.
    if (!store.has(sessionId, uri)) return
    store.emitUpdate({ sessionId, uri, at: new Date().toISOString() })
  })
}
