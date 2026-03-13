import { useMemo, useState } from 'react'

type ResultRendererProps = {
  title?: string | null
  result: unknown
  onClear: () => void
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

function ResultRenderer({ title, result, onClear }: ResultRendererProps): React.JSX.Element {
  const [isRawView, setIsRawView] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

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
        <p className="text-xs font-medium text-slate-300">{title ?? 'Result'}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsRawView((current) => !current)
            }}
            className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
          >
            {isRawView ? 'Tree' : 'Raw'}
          </button>
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

      {isRawView ? (
        <pre className="max-h-56 overflow-auto text-xs text-slate-300">{raw}</pre>
      ) : (
        <div className="max-h-56 overflow-auto space-y-1">
          <JsonNode value={result} depth={0} />
        </div>
      )}
    </div>
  )
}

export default ResultRenderer
