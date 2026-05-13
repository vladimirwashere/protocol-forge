import { useMemo } from 'react'

import { LOG_LEVELS, type LogLevel } from '../../../../shared/ipc'
import { isAtLeast, useLoggingStore } from '../../stores/logging-store'

type LogsPanelProps = {
  sessionId: string | null
  loggingSupported: boolean
}

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: 'text-slate-400',
  info: 'text-sky-300',
  notice: 'text-sky-200',
  warning: 'text-amber-300',
  error: 'text-rose-300',
  critical: 'text-rose-400',
  alert: 'text-rose-400',
  emergency: 'text-rose-500'
}

function renderData(data: unknown): string {
  if (typeof data === 'string') return data
  try {
    return JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

function LogsPanel({ sessionId, loggingSupported }: LogsPanelProps): React.JSX.Element {
  const entries = useLoggingStore((state) => state.entries)
  const minLevel = useLoggingStore((state) => state.minLevel)
  const selectedLevel = useLoggingStore((state) => state.selectedLevel)
  const setLevelPending = useLoggingStore((state) => state.setLevelPending)
  const setLevelError = useLoggingStore((state) => state.setLevelError)
  const setMinLevel = useLoggingStore((state) => state.setMinLevel)
  const applyLevelToServer = useLoggingStore((state) => state.applyLevelToServer)
  const clear = useLoggingStore((state) => state.clear)

  const filtered = useMemo(
    () => entries.filter((entry) => isAtLeast(entry.level, minLevel)),
    [entries, minLevel]
  )

  return (
    <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-2">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
          Server Logs
        </h4>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <label className="flex items-center gap-1">
            <span>Server level</span>
            <select
              value={selectedLevel}
              disabled={!sessionId || !loggingSupported || setLevelPending}
              onChange={(event) => {
                if (!sessionId) return
                void applyLevelToServer(sessionId, event.target.value as LogLevel)
              }}
              className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5 disabled:opacity-50"
            >
              {LOG_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span>Filter ≥</span>
            <select
              value={minLevel}
              onChange={(event) => {
                setMinLevel(event.target.value as LogLevel)
              }}
              className="rounded border border-slate-700 bg-slate-950 px-1 py-0.5"
            >
              {LOG_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={clear}
            className="rounded border border-slate-700 px-2 py-0.5 text-slate-300"
          >
            Clear
          </button>
        </div>
      </div>
      {!loggingSupported ? (
        <p className="text-xs text-slate-500">Server has not advertised the logging capability.</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-slate-500">
          No log messages at this level{entries.length > 0 ? ' (raise the filter)' : ''}.
        </p>
      ) : (
        <ul className="max-h-[min(14rem,40vh)] space-y-1 overflow-auto text-xs">
          {filtered.map((entry) => (
            <li
              key={entry.id}
              className="rounded border border-slate-800 bg-slate-900/40 px-2 py-1"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`font-mono uppercase tracking-[0.08em] ${LEVEL_COLOR[entry.level]}`}
                >
                  {entry.level}
                  {entry.logger ? <span className="text-slate-500"> · {entry.logger}</span> : null}
                </span>
                <span className="text-slate-500">{new Date(entry.at).toLocaleTimeString()}</span>
              </div>
              <pre className="mt-1 whitespace-pre-wrap break-words text-slate-300">
                {renderData(entry.data)}
              </pre>
            </li>
          ))}
        </ul>
      )}
      {setLevelError ? <p className="mt-1 text-xs text-rose-400">{setLevelError}</p> : null}
    </div>
  )
}

export default LogsPanel
