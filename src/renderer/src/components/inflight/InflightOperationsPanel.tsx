import type { InflightCancelInput, InflightOperationSummary } from '../../../../shared/ipc'

type InflightOperationsPanelProps = {
  operations: InflightOperationSummary[]
  error: string | null
  onCancel: (input: InflightCancelInput) => Promise<void>
}

const kindLabel: Record<InflightOperationSummary['kind'], string> = {
  tool: 'Tool',
  resource: 'Resource',
  prompt: 'Prompt'
}

function formatProgress(operation: InflightOperationSummary): string | null {
  if (!operation.lastProgress) return null
  const { progress, total, message } = operation.lastProgress
  const pct = total && total > 0 ? Math.round((progress / total) * 100) : null
  const numeric = pct !== null ? `${pct}% (${progress}/${total})` : `${progress}`
  return message ? `${numeric} — ${message}` : numeric
}

function progressPercent(operation: InflightOperationSummary): number | null {
  const last = operation.lastProgress
  if (!last || !last.total || last.total <= 0) return null
  return Math.min(100, Math.max(0, Math.round((last.progress / last.total) * 100)))
}

function InflightOperationsPanel({
  operations,
  error,
  onCancel
}: InflightOperationsPanelProps): React.JSX.Element | null {
  if (operations.length === 0 && !error) {
    return null
  }

  return (
    <div className="rounded border border-slate-800 bg-slate-900/60 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-200">In-flight Operations</h3>
        <span className="text-[11px] text-slate-500">{operations.length} active</span>
      </div>

      {error ? <p className="mt-2 text-xs text-rose-400">{error}</p> : null}

      <ul className="mt-3 space-y-2">
        {operations.map((operation) => {
          const progressText = formatProgress(operation)
          const pct = progressPercent(operation)
          return (
            <li
              key={operation.operationId}
              className="rounded border border-slate-800 bg-slate-950/40 p-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-200">
                    <span className="text-slate-500">{kindLabel[operation.kind]}:</span>{' '}
                    <span className="break-all">{operation.label}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Started {new Date(operation.startedAt).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void onCancel({ operationId: operation.operationId, reason: 'User cancelled' })
                  }}
                  className="rounded border border-rose-700 px-2 py-1 text-[11px] text-rose-200 hover:bg-rose-900/30"
                >
                  Cancel
                </button>
              </div>
              {progressText ? (
                <div className="mt-2">
                  <p className="text-[11px] text-slate-400">{progressText}</p>
                  {pct !== null ? (
                    <div className="mt-1 h-1 w-full overflow-hidden rounded bg-slate-800">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export default InflightOperationsPanel
