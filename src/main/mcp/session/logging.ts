import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { LoggingMessageNotificationSchema } from '@modelcontextprotocol/sdk/types.js'

import type { LogLevel, LogNotification } from '../../../shared/ipc'
import { LOG_LEVELS } from '../../../shared/ipc'

type NotificationListener = (notification: LogNotification) => void

export class LogNotificationsBus {
  private readonly listeners = new Set<NotificationListener>()

  onNotification(listener: NotificationListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(notification: LogNotification): void {
    for (const listener of this.listeners) listener(notification)
  }
}

function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === 'string' && (LOG_LEVELS as readonly string[]).includes(value)
}

export function registerLogNotificationHandler(
  client: Client,
  sessionId: string,
  bus: LogNotificationsBus
): void {
  client.setNotificationHandler(LoggingMessageNotificationSchema, (notification) => {
    const params = notification.params
    // Defensive: spec fixes the level enum, but treat external data as untrusted and skip
    // anything that does not match the enum rather than letting the renderer see a bad value.
    if (!isLogLevel(params.level)) return
    const projected: LogNotification = {
      sessionId,
      level: params.level,
      data: params.data,
      at: new Date().toISOString()
    }
    if (typeof params.logger === 'string') projected.logger = params.logger
    bus.emit(projected)
  })
}

export async function setLoggingLevel(client: Client, level: LogLevel): Promise<void> {
  await client.setLoggingLevel(level)
}
