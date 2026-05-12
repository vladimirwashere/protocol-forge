import { useMemo, useState } from 'react'

import type {
  SamplingPendingRequest,
  SamplingRejectInput,
  SamplingRespondInput
} from '../../../../shared/ipc'

type SamplingPanelProps = {
  pending: SamplingPendingRequest[]
  error: string | null
  onRespond: (input: SamplingRespondInput) => Promise<void>
  onReject: (input: SamplingRejectInput) => Promise<void>
}

function SamplingPanel({
  pending,
  error,
  onRespond,
  onReject
}: SamplingPanelProps): React.JSX.Element | null {
  if (pending.length === 0 && !error) {
    return null
  }

  return (
    <div className="rounded border border-amber-900/60 bg-amber-950/20 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-amber-200">
          Sampling Requests
          {pending.length > 0 ? (
            <span className="ml-2 rounded bg-amber-800/60 px-1.5 py-0.5 text-xs font-medium text-amber-100">
              {pending.length}
            </span>
          ) : null}
        </h2>
      </div>

      {error ? (
        <div className="mt-3 rounded border border-rose-900/70 bg-rose-950/20 p-2 text-xs text-rose-300">
          {error}
        </div>
      ) : null}

      <p className="mt-2 text-xs text-amber-200/80">
        A connected server has called <code className="font-mono">sampling/createMessage</code>.
        Compose a mock response — Protocol Forge does not call an LLM.
      </p>

      <div className="mt-3 space-y-3">
        {pending.map((request) => (
          <SamplingRequestCard
            key={request.requestId}
            request={request}
            onRespond={onRespond}
            onReject={onReject}
          />
        ))}
      </div>
    </div>
  )
}

type CardProps = {
  request: SamplingPendingRequest
  onRespond: (input: SamplingRespondInput) => Promise<void>
  onReject: (input: SamplingRejectInput) => Promise<void>
}

function SamplingRequestCard({ request, onRespond, onReject }: CardProps): React.JSX.Element {
  const [model, setModel] = useState('mock-model')
  const [role, setRole] = useState<'assistant' | 'user'>('assistant')
  const [stopReason, setStopReason] = useState('endTurn')
  const [text, setText] = useState('')
  const [showParams, setShowParams] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const paramsJson = useMemo(() => {
    try {
      return JSON.stringify(request.params, null, 2)
    } catch {
      return String(request.params)
    }
  }, [request.params])

  const handleRespond = async (): Promise<void> => {
    if (text.trim().length === 0) {
      setLocalError('Response text is required')
      return
    }
    setLocalError(null)
    setSubmitting(true)
    try {
      await onRespond({
        requestId: request.requestId,
        model: model.trim() || 'mock-model',
        role,
        content: { type: 'text', text },
        ...(stopReason.trim().length > 0 ? { stopReason: stopReason.trim() } : {})
      })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to respond')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReject = async (): Promise<void> => {
    setLocalError(null)
    setSubmitting(true)
    try {
      await onReject({
        requestId: request.requestId,
        message: 'Sampling request declined by user'
      })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to decline')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded border border-amber-900/40 bg-slate-950/60 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-mono text-amber-200/90">{request.requestId}</div>
          <div className="text-[11px] text-slate-500">
            Session {request.sessionId.slice(0, 8)}… · {request.createdAt}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-xs text-slate-300 hover:bg-slate-800"
          onClick={() => setShowParams((v) => !v)}
        >
          {showParams ? 'Hide params' : 'Show params'}
        </button>
      </div>

      {showParams ? (
        <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-900/80 p-2 text-[11px] text-slate-300">
          {paramsJson}
        </pre>
      ) : null}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-300">
          Model
          <input
            type="text"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            disabled={submitting}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
          />
        </label>
        <label className="text-xs text-slate-300">
          Role
          <select
            value={role}
            onChange={(event) => setRole(event.target.value === 'user' ? 'user' : 'assistant')}
            disabled={submitting}
            className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
          >
            <option value="assistant">assistant</option>
            <option value="user">user</option>
          </select>
        </label>
      </div>

      <label className="mt-2 block text-xs text-slate-300">
        Stop reason
        <input
          type="text"
          value={stopReason}
          onChange={(event) => setStopReason(event.target.value)}
          disabled={submitting}
          placeholder="endTurn | maxTokens | stopSequence | custom"
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
        />
      </label>

      <label className="mt-2 block text-xs text-slate-300">
        Response text
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={submitting}
          rows={4}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 font-mono text-xs text-slate-100"
        />
      </label>

      {localError ? (
        <div className="mt-2 rounded border border-rose-900/70 bg-rose-950/30 p-2 text-xs text-rose-300">
          {localError}
        </div>
      ) : null}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            void handleReject()
          }}
          className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            void handleRespond()
          }}
          className="rounded border border-emerald-700 bg-emerald-900/40 px-3 py-1 text-xs text-emerald-100 hover:bg-emerald-900/70 disabled:opacity-50"
        >
          Respond
        </button>
      </div>
    </div>
  )
}

export default SamplingPanel
