import { useMemo, useState } from 'react'

import { validateAgainstOutputSchema } from './output-schema-validator'

type ResultRendererProps = {
  title?: string | null
  result: unknown
  latencyMs?: number | null
  outputSchema?: Record<string, unknown> | null
  onClear: () => void
}

type ViewMode = 'tree' | 'raw' | 'structured'

const extractStructuredContent = (result: unknown): Record<string, unknown> | null => {
  if (result === null || typeof result !== 'object') return null
  const record = result as Record<string, unknown>
  const structured = record.structuredContent
  if (structured === null || typeof structured !== 'object' || Array.isArray(structured)) {
    return null
  }
  return structured as Record<string, unknown>
}

function JsonNode({
  label,
  value,
  depth
}: {
  label?: string
  value: unknown
  depth: number
}): React.JSX.Element {
  const isObject = typeof value === 'object' && value !== null

  if (!isObject) {
    return (
      <div className="text-xs text-slate-300">
        {label ? <span className="text-slate-400">{label}: </span> : null}
        <span>{JSON.stringify(value)}</span>
      </div>
    )
  }

  if (Array.isArray(value)) {
    return (
      <details open={depth < 1} className="text-xs text-slate-300">
        <summary className="cursor-pointer text-slate-300">
          {label ? `${label}: ` : ''}[{value.length}]
        </summary>
        <div className="ml-4 mt-1 space-y-1 border-l border-slate-800 pl-2">
          {value.map((entry, index) => (
            <JsonNode key={index} label={String(index)} value={entry} depth={depth + 1} />
          ))}
        </div>
      </details>
    )
  }

  const entries = Object.entries(value)

  return (
    <details open={depth < 1} className="text-xs text-slate-300">
      <summary className="cursor-pointer text-slate-300">
        {label ? `${label}: ` : ''}
        {`{ ${entries.length} keys }`}
      </summary>
      <div className="ml-4 mt-1 space-y-1 border-l border-slate-800 pl-2">
        {entries.map(([entryKey, entryValue]) => (
          <JsonNode key={entryKey} label={entryKey} value={entryValue} depth={depth + 1} />
        ))}
      </div>
    </details>
  )
}

function ResultRenderer({
  title,
  result,
  latencyMs,
  outputSchema,
  onClear
}: ResultRendererProps): React.JSX.Element {
  const structuredContent = useMemo(() => extractStructuredContent(result), [result])
  const hasStructuredView = structuredContent !== null && outputSchema != null
  const [viewMode, setViewMode] = useState<ViewMode>(hasStructuredView ? 'structured' : 'tree')
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const validation = useMemo(() => {
    if (!hasStructuredView) return null
    return validateAgainstOutputSchema(outputSchema, structuredContent)
  }, [hasStructuredView, outputSchema, structuredContent])

  const raw = useMemo(() => JSON.stringify(result, null, 2), [result])

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(raw)
      setCopyFeedback('Copied')
    } catch {
      setCopyFeedback('Copy failed')
    }

    window.setTimeout(() => {
      setCopyFeedback(null)
    }, 1200)
  }

  return (
    <div className="mt-3 rounded border border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-slate-300">{title ?? 'Result'}</p>
          {latencyMs !== null && latencyMs !== undefined ? (
            <span className="rounded border border-emerald-700/70 bg-emerald-950/40 px-2 py-0.5 text-[11px] text-emerald-300">
              {Math.round(latencyMs)} ms
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded border border-slate-700 p-0.5 text-[11px]">
            {hasStructuredView ? (
              <button
                onClick={() => {
                  setViewMode('structured')
                }}
                className={`rounded px-2 py-0.5 ${
                  viewMode === 'structured' ? 'bg-slate-700 text-white' : 'text-slate-400'
                }`}
              >
                Structured
              </button>
            ) : null}
            <button
              onClick={() => {
                setViewMode('tree')
              }}
              className={`rounded px-2 py-0.5 ${
                viewMode === 'tree' ? 'bg-slate-700 text-white' : 'text-slate-400'
              }`}
            >
              Tree
            </button>
            <button
              onClick={() => {
                setViewMode('raw')
              }}
              className={`rounded px-2 py-0.5 ${
                viewMode === 'raw' ? 'bg-slate-700 text-white' : 'text-slate-400'
              }`}
            >
              Raw
            </button>
          </div>
          <button
            onClick={() => {
              void handleCopy()
            }}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
          >
            {copyFeedback ?? 'Copy'}
          </button>
          <button
            onClick={onClear}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
          >
            Clear
          </button>
        </div>
      </div>

      {hasStructuredView && viewMode === 'structured' && validation ? (
        <div className="space-y-2">
          {validation.ok ? (
            <div className="rounded border border-emerald-800 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-300">
              Structured content matches the tool&apos;s output schema.
            </div>
          ) : (
            <div className="rounded border border-rose-800 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-300">
              <p className="font-semibold">
                Structured content does not match the tool&apos;s output schema.
              </p>
              <ul className="mt-1 list-disc pl-4">
                {validation.errors.map((err, index) => (
                  <li key={index}>
                    <span className="font-mono">{err.path}</span>: {err.message}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-slate-400">
                Falls back to the raw <span className="font-mono">content</span> in the Tree view.
              </p>
            </div>
          )}
          <div className="max-h-56 space-y-1 overflow-auto">
            <JsonNode value={structuredContent} depth={0} />
          </div>
        </div>
      ) : null}

      {viewMode === 'tree' ? (
        <div className="max-h-56 space-y-1 overflow-auto">
          <JsonNode value={result} depth={0} />
        </div>
      ) : null}

      {viewMode === 'raw' ? (
        <pre className="max-h-56 overflow-auto text-xs text-slate-300">{raw}</pre>
      ) : null}
    </div>
  )
}

export default ResultRenderer
