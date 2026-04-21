import { useMemo, useRef, useState } from 'react'
import type { SessionMessage, SessionStatus, SessionSummary } from '../../../../shared/ipc'

type ProtocolInspectorProps = {
  sessionStatus: SessionStatus | null
  sessionMessages: SessionMessage[]
  sessionHistory: SessionSummary[]
  sessionError: string | null
  paused: boolean
  directionFilter: 'all' | 'outbound' | 'inbound'
  methodFilter: string
  searchFilter: string
  onRefreshSessions: () => void
  onRefreshMessages: () => void
  onDisconnect: () => void
  onInspectSession: (sessionId: string) => void
  onTogglePaused: () => void
  onClearMessages: () => void
  onDirectionFilterChange: (value: 'all' | 'outbound' | 'inbound') => void
  onMethodFilterChange: (value: string) => void
  onSearchFilterChange: (value: string) => void
}

const getPayloadMethod = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const method = (payload as { method?: unknown }).method
  if (typeof method === 'string') {
    return method
  }

  return null
}

const includesText = (payload: unknown, searchFilter: string): boolean => {
  if (searchFilter.trim().length === 0) {
    return true
  }

  const search = searchFilter.toLowerCase()
  return JSON.stringify(payload).toLowerCase().includes(search)
}

type SessionHistoryGroup = {
  key: string
  label: string
  sessions: SessionSummary[]
}

const formatDuration = (durationMs?: number): string => {
  if (durationMs === undefined) {
    return 'active'
  }

  if (durationMs < 1000) {
    return `${durationMs} ms`
  }

  const seconds = Math.round(durationMs / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remSeconds = seconds % 60
  return `${minutes}m ${remSeconds}s`
}

const VIRTUAL_ROW_HEIGHT = 72
const VIRTUAL_VIEWPORT_HEIGHT = 224
const VIRTUAL_OVERSCAN = 6

function ProtocolInspector({
  sessionStatus,
  sessionMessages,
  sessionHistory,
  sessionError,
  paused,
  directionFilter,
  methodFilter,
  searchFilter,
  onRefreshSessions,
  onRefreshMessages,
  onDisconnect,
  onInspectSession,
  onTogglePaused,
  onClearMessages,
  onDirectionFilterChange,
  onMethodFilterChange,
  onSearchFilterChange
}: ProtocolInspectorProps): React.JSX.Element {
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null)
  const [virtualScrollTop, setVirtualScrollTop] = useState(0)
  const listContainerRef = useRef<HTMLDivElement | null>(null)

  const filteredMessages = useMemo(() => {
    const normalizedMethod = methodFilter.trim().toLowerCase()

    return sessionMessages.filter((message) => {
      if (directionFilter !== 'all' && message.direction !== directionFilter) {
        return false
      }

      const method = getPayloadMethod(message.payload)
      if (normalizedMethod.length > 0) {
        if (!method || !method.toLowerCase().includes(normalizedMethod)) {
          return false
        }
      }

      return includesText(message.payload, searchFilter)
    })
  }, [directionFilter, methodFilter, searchFilter, sessionMessages])

  const selectedMessage =
    filteredMessages.find((message) => message.id === selectedMessageId) ??
    filteredMessages.at(-1) ??
    null

  const { visibleMessages, topSpacerHeight, bottomSpacerHeight } = useMemo(() => {
    if (filteredMessages.length === 0) {
      return {
        visibleMessages: [] as typeof filteredMessages,
        topSpacerHeight: 0,
        bottomSpacerHeight: 0
      }
    }

    const startIndex = Math.max(
      0,
      Math.floor(virtualScrollTop / VIRTUAL_ROW_HEIGHT) - VIRTUAL_OVERSCAN
    )
    const visibleCount =
      Math.ceil(VIRTUAL_VIEWPORT_HEIGHT / VIRTUAL_ROW_HEIGHT) + VIRTUAL_OVERSCAN * 2
    const endIndex = Math.min(filteredMessages.length, startIndex + visibleCount)

    return {
      visibleMessages: filteredMessages.slice(startIndex, endIndex),
      topSpacerHeight: startIndex * VIRTUAL_ROW_HEIGHT,
      bottomSpacerHeight: (filteredMessages.length - endIndex) * VIRTUAL_ROW_HEIGHT
    }
  }, [filteredMessages, virtualScrollTop])

  const groupedHistory = useMemo<SessionHistoryGroup[]>(() => {
    const groups = new Map<string, SessionHistoryGroup>()

    for (const session of sessionHistory) {
      const key = session.serverProfileId ?? `adhoc:${session.transport}`
      const label = session.serverProfileName ?? session.serverProfileId ?? 'Direct Connections'

      const existing = groups.get(key)
      if (existing) {
        existing.sessions.push(session)
        continue
      }

      groups.set(key, {
        key,
        label,
        sessions: [session]
      })
    }

    return [...groups.values()]
  }, [sessionHistory])

  return (
    <>
      <h3 className="text-sm font-medium text-slate-300">Protocol Inspector</h3>
      {sessionStatus ? (
        <div className="mt-2 space-y-2 text-sm text-slate-400">
          <p>Session: {sessionStatus.sessionId}</p>
          <p>State: {sessionStatus.state}</p>
          <p>Messages: {sessionStatus.messageCount}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onRefreshSessions}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
            >
              Refresh Sessions
            </button>
            <button
              onClick={onRefreshMessages}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
            >
              Refresh Messages
            </button>
            <button
              onClick={onTogglePaused}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
            >
              {paused ? 'Resume' : 'Pause'} Stream
            </button>
            <button
              onClick={onClearMessages}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
            >
              Clear Buffer
            </button>
            <button
              onClick={onDisconnect}
              className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
            >
              Disconnect Active Session
            </button>
          </div>

          <div className="grid gap-2 rounded border border-slate-800 bg-slate-950/60 p-2 text-xs text-slate-300 grid-cols-3">
            <label className="space-y-1">
              <span className="block text-slate-500">Direction</span>
              <select
                value={directionFilter}
                onChange={(event) => {
                  const value = event.target.value as 'all' | 'outbound' | 'inbound'
                  onDirectionFilterChange(value)
                }}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              >
                <option value="all">all</option>
                <option value="outbound">outbound</option>
                <option value="inbound">inbound</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="block text-slate-500">Method</span>
              <input
                value={methodFilter}
                onChange={(event) => {
                  onMethodFilterChange(event.target.value)
                }}
                placeholder="tools/call"
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
            </label>
            <label className="space-y-1">
              <span className="block text-slate-500">Search payload</span>
              <input
                value={searchFilter}
                onChange={(event) => {
                  onSearchFilterChange(event.target.value)
                }}
                placeholder="text or key"
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1"
              />
            </label>
          </div>

          <div className="text-xs text-slate-500">Visible messages: {filteredMessages.length}</div>

          <div className="grid gap-2 grid-cols-2">
            <div
              ref={listContainerRef}
              onScroll={(event) => {
                setVirtualScrollTop(event.currentTarget.scrollTop)
              }}
              className="max-h-[min(14rem,40vh)] space-y-2 overflow-auto rounded border border-slate-800 bg-slate-950/60 p-2"
            >
              {filteredMessages.length === 0 ? (
                <p className="text-xs text-slate-500">No captured messages yet.</p>
              ) : (
                <>
                  {topSpacerHeight > 0 ? <div style={{ height: `${topSpacerHeight}px` }} /> : null}
                  {visibleMessages.map((message) => {
                    const method = getPayloadMethod(message.payload)

                    return (
                      <button
                        key={message.id}
                        onClick={() => {
                          setSelectedMessageId(message.id)
                        }}
                        className={`w-full rounded border p-2 text-left ${
                          selectedMessage?.id === message.id
                            ? 'border-slate-500 bg-slate-800/70'
                            : 'border-slate-800 bg-slate-900/50'
                        }`}
                        style={{ minHeight: `${VIRTUAL_ROW_HEIGHT}px` }}
                      >
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.08em]">
                          <span
                            className={
                              message.direction === 'outbound' ? 'text-emerald-400' : 'text-sky-400'
                            }
                          >
                            {message.direction}
                          </span>
                          <span className="text-slate-500">
                            {new Date(message.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-xs text-slate-300">
                          {method ?? '(no method field)'}
                        </div>
                        {message.latencyMs !== undefined ? (
                          <div className="mt-1 text-[11px] text-emerald-300">
                            {Math.round(message.latencyMs)} ms
                          </div>
                        ) : null}
                      </button>
                    )
                  })}
                  {bottomSpacerHeight > 0 ? (
                    <div style={{ height: `${bottomSpacerHeight}px` }} />
                  ) : null}
                </>
              )}
            </div>

            <div className="max-h-[min(14rem,40vh)] overflow-auto rounded border border-slate-800 bg-slate-950/60 p-2">
              {selectedMessage ? (
                <>
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <div className="text-slate-400">
                      <span className="uppercase">{selectedMessage.direction}</span>
                      {' • '}
                      {getPayloadMethod(selectedMessage.payload) ?? '(no method field)'}
                      {selectedMessage.latencyMs !== undefined ? (
                        <>
                          {' • '}
                          <span className="text-emerald-300">
                            {Math.round(selectedMessage.latencyMs)} ms
                          </span>
                        </>
                      ) : null}
                      {selectedMessage.isError ? (
                        <>
                          {' • '}
                          <span className="text-rose-300">error</span>
                        </>
                      ) : null}
                    </div>
                    <button
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          JSON.stringify(selectedMessage.payload, null, 2)
                        )
                      }}
                      className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
                    >
                      Copy Message
                    </button>
                  </div>
                  <pre className="text-xs text-slate-300">
                    {JSON.stringify(selectedMessage.payload, null, 2)}
                  </pre>
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  Select a message to inspect payload details.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">No session traffic yet.</p>
      )}

      <div className="mt-3 max-h-48 space-y-3 overflow-auto rounded border border-slate-800 bg-slate-950/60 p-2">
        {groupedHistory.length === 0 ? (
          <p className="text-xs text-slate-500">No recent sessions.</p>
        ) : (
          groupedHistory.map((group) => (
            <div key={group.key} className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                {group.label}
              </p>
              <div className="space-y-2">
                {group.sessions.map((session) => (
                  <button
                    key={session.sessionId}
                    onClick={() => onInspectSession(session.sessionId)}
                    className={`w-full rounded border p-2 text-left text-xs ${
                      sessionStatus?.sessionId === session.sessionId
                        ? 'border-slate-500 bg-slate-800/70'
                        : 'border-slate-800 bg-slate-900/40'
                    }`}
                  >
                    <p className="font-medium text-slate-300">{session.sessionId}</p>
                    <p className="mt-1 text-slate-500">
                      {session.state} • {session.messageCount} messages • errors{' '}
                      {session.errorCount}
                    </p>
                    <p className="mt-1 text-slate-500">
                      duration {formatDuration(session.durationMs)}
                      {session.avgLatencyMs !== undefined ? (
                        <> • avg latency {Math.round(session.avgLatencyMs)} ms</>
                      ) : (
                        ' • avg latency n/a'
                      )}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
      {sessionError ? <p className="mt-2 text-xs text-rose-400">{sessionError}</p> : null}
    </>
  )
}

export default ProtocolInspector
