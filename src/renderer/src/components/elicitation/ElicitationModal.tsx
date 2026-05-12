import { useEffect, useMemo, useState } from 'react'

import type {
  ElicitationContentValue,
  ElicitationPendingRequest,
  ElicitationRespondInput
} from '../../../../shared/ipc'

type ElicitationModalProps = {
  pending: ElicitationPendingRequest[]
  error: string | null
  onRespond: (input: ElicitationRespondInput) => Promise<void>
}

function ElicitationModal({
  pending,
  error,
  onRespond
}: ElicitationModalProps): React.JSX.Element | null {
  if (pending.length === 0 && !error) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="w-full max-w-2xl space-y-3">
        {error ? (
          <div className="rounded border border-rose-900/70 bg-rose-950/30 p-2 text-xs text-rose-300">
            {error}
          </div>
        ) : null}
        {pending.length > 0 ? (
          <ElicitationCard request={pending[0]!} onRespond={onRespond} />
        ) : null}
        {pending.length > 1 ? (
          <div className="rounded border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-400">
            {pending.length - 1} more elicitation
            {pending.length - 1 === 1 ? '' : 's'} queued.
          </div>
        ) : null}
      </div>
    </div>
  )
}

type CardProps = {
  request: ElicitationPendingRequest
  onRespond: (input: ElicitationRespondInput) => Promise<void>
}

function ElicitationCard({ request, onRespond }: CardProps): React.JSX.Element {
  const [submitting, setSubmitting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [formValues, setFormValues] = useState<Record<string, ElicitationContentValue>>({})

  useEffect(() => {
    setFormValues(initialValuesFromSchema(request.requestedSchema))
    setLocalError(null)
  }, [request.requestId, request.requestedSchema])

  const dispatch = async (
    action: ElicitationRespondInput['action'],
    content?: Record<string, ElicitationContentValue>
  ): Promise<void> => {
    setLocalError(null)
    setSubmitting(true)
    try {
      await onRespond({
        requestId: request.requestId,
        action,
        ...(content !== undefined ? { content } : {})
      })
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Failed to respond')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded border border-indigo-900/70 bg-slate-950/95 p-4 shadow-xl">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-indigo-200">
          Elicitation Request
          <span className="ml-2 rounded bg-indigo-900/60 px-1.5 py-0.5 text-[11px] font-medium uppercase text-indigo-100">
            {request.mode}
          </span>
        </h2>
        <span className="truncate text-[11px] text-slate-500" title={request.sessionId}>
          Session {request.sessionId.slice(0, 8)}…
        </span>
      </div>

      <p className="mt-2 text-sm text-slate-200">{request.message}</p>

      {request.mode === 'url' ? (
        <UrlModeBody url={request.url ?? ''} />
      ) : (
        <FormModeBody
          schema={request.requestedSchema}
          values={formValues}
          onChange={setFormValues}
          disabled={submitting}
        />
      )}

      {localError ? (
        <div className="mt-3 rounded border border-rose-900/70 bg-rose-950/30 p-2 text-xs text-rose-300">
          {localError}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            void dispatch('cancel')
          }}
          className="rounded border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            void dispatch('decline')
          }}
          className="rounded border border-amber-800 bg-amber-950/40 px-3 py-1 text-xs text-amber-100 hover:bg-amber-900/60 disabled:opacity-50"
        >
          Decline
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            void dispatch('accept', request.mode === 'form' ? formValues : undefined)
          }}
          className="rounded border border-emerald-700 bg-emerald-900/40 px-3 py-1 text-xs text-emerald-100 hover:bg-emerald-900/70 disabled:opacity-50"
        >
          {request.mode === 'url' ? 'Open & Accept' : 'Accept'}
        </button>
      </div>
    </div>
  )
}

function UrlModeBody({ url }: { url: string }): React.JSX.Element {
  return (
    <div className="mt-3 rounded border border-slate-800 bg-slate-900/70 p-3">
      <div className="text-[11px] uppercase text-slate-500">Destination</div>
      <div className="mt-1 break-all font-mono text-xs text-indigo-200">{url || '(no url)'}</div>
      <p className="mt-2 text-[11px] text-slate-400">
        Accepting will open this URL in your default browser.
      </p>
    </div>
  )
}

type FormFieldSchema = {
  type?: string
  title?: string
  description?: string
  enum?: unknown
  enumNames?: unknown
  oneOf?: unknown
  default?: unknown
  format?: string
  items?: unknown
}

type FormModeBodyProps = {
  schema: unknown
  values: Record<string, ElicitationContentValue>
  onChange: (values: Record<string, ElicitationContentValue>) => void
  disabled: boolean
}

function FormModeBody({
  schema,
  values,
  onChange,
  disabled
}: FormModeBodyProps): React.JSX.Element {
  const properties = useMemo(() => extractProperties(schema), [schema])

  if (properties.length === 0) {
    return (
      <p className="mt-3 text-xs text-slate-400">
        No form fields requested. Accept to send an empty response.
      </p>
    )
  }

  const update = (key: string, value: ElicitationContentValue): void => {
    onChange({ ...values, [key]: value })
  }

  return (
    <div className="mt-3 space-y-3">
      {properties.map(({ name, field }) => (
        <FieldRow
          key={name}
          name={name}
          field={field}
          value={values[name]}
          disabled={disabled}
          onChange={(value) => update(name, value)}
        />
      ))}
    </div>
  )
}

type FieldRowProps = {
  name: string
  field: FormFieldSchema
  value: ElicitationContentValue | undefined
  disabled: boolean
  onChange: (value: ElicitationContentValue) => void
}

function FieldRow({ name, field, value, disabled, onChange }: FieldRowProps): React.JSX.Element {
  const label = field.title ?? name

  if (field.type === 'boolean') {
    return (
      <label className="flex items-start gap-2 text-xs text-slate-200">
        <input
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">{label}</span>
          {field.description ? (
            <span className="mt-0.5 block text-[11px] text-slate-400">{field.description}</span>
          ) : null}
        </span>
      </label>
    )
  }

  if (field.type === 'number' || field.type === 'integer') {
    return (
      <label className="block text-xs text-slate-200">
        <span className="font-medium">{label}</span>
        {field.description ? (
          <span className="mt-0.5 block text-[11px] text-slate-400">{field.description}</span>
        ) : null}
        <input
          type="number"
          step={field.type === 'integer' ? 1 : 'any'}
          value={typeof value === 'number' ? value : ''}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value
            if (next === '') return
            const parsed =
              field.type === 'integer' ? Number.parseInt(next, 10) : Number.parseFloat(next)
            if (!Number.isNaN(parsed)) onChange(parsed)
          }}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
        />
      </label>
    )
  }

  const enumOptions = extractEnumOptions(field)
  if (enumOptions && field.type === 'string') {
    return (
      <label className="block text-xs text-slate-200">
        <span className="font-medium">{label}</span>
        {field.description ? (
          <span className="mt-0.5 block text-[11px] text-slate-400">{field.description}</span>
        ) : null}
        <select
          value={typeof value === 'string' ? value : ''}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
        >
          <option value="" disabled>
            Select…
          </option>
          {enumOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    )
  }

  if (field.type === 'array') {
    const itemOptions = extractArrayEnumOptions(field)
    if (itemOptions) {
      const selected = Array.isArray(value) ? value : []
      return (
        <div className="text-xs text-slate-200">
          <span className="font-medium">{label}</span>
          {field.description ? (
            <span className="mt-0.5 block text-[11px] text-slate-400">{field.description}</span>
          ) : null}
          <div className="mt-1 space-y-1 rounded border border-slate-700 bg-slate-900 p-2">
            {itemOptions.map((option) => {
              const isChecked = selected.includes(option.value)
              return (
                <label key={option.value} className="flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...selected, option.value]
                        : selected.filter((item) => item !== option.value)
                      onChange(next)
                    }}
                  />
                  <span>{option.label}</span>
                </label>
              )
            })}
          </div>
        </div>
      )
    }
  }

  const inputType =
    field.type === 'string' && field.format === 'date'
      ? 'date'
      : field.format === 'date-time'
        ? 'datetime-local'
        : field.format === 'email'
          ? 'email'
          : field.format === 'uri'
            ? 'url'
            : 'text'

  return (
    <label className="block text-xs text-slate-200">
      <span className="font-medium">{label}</span>
      {field.description ? (
        <span className="mt-0.5 block text-[11px] text-slate-400">{field.description}</span>
      ) : null}
      <input
        type={inputType}
        value={typeof value === 'string' ? value : ''}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-100"
      />
    </label>
  )
}

type EnumOption = { value: string; label: string }

function extractEnumOptions(field: FormFieldSchema): EnumOption[] | null {
  if (Array.isArray(field.oneOf)) {
    return field.oneOf
      .filter((entry): entry is { const: string; title: string } => {
        return (
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as { const?: unknown }).const === 'string' &&
          typeof (entry as { title?: unknown }).title === 'string'
        )
      })
      .map((entry) => ({ value: entry.const, label: entry.title }))
  }

  if (Array.isArray(field.enum)) {
    const enumValues = field.enum.filter((item): item is string => typeof item === 'string')
    if (enumValues.length === 0) return null
    const names = Array.isArray(field.enumNames)
      ? field.enumNames.filter((item): item is string => typeof item === 'string')
      : []
    return enumValues.map((value, index) => ({
      value,
      label: names[index] ?? value
    }))
  }
  return null
}

function extractArrayEnumOptions(field: FormFieldSchema): EnumOption[] | null {
  const items = field.items
  if (typeof items !== 'object' || items === null) return null
  const rec = items as { enum?: unknown; anyOf?: unknown }

  if (Array.isArray(rec.anyOf)) {
    return rec.anyOf
      .filter((entry): entry is { const: string; title: string } => {
        return (
          typeof entry === 'object' &&
          entry !== null &&
          typeof (entry as { const?: unknown }).const === 'string' &&
          typeof (entry as { title?: unknown }).title === 'string'
        )
      })
      .map((entry) => ({ value: entry.const, label: entry.title }))
  }

  if (Array.isArray(rec.enum)) {
    const values = rec.enum.filter((item): item is string => typeof item === 'string')
    if (values.length === 0) return null
    return values.map((value) => ({ value, label: value }))
  }
  return null
}

function extractProperties(schema: unknown): Array<{ name: string; field: FormFieldSchema }> {
  if (typeof schema !== 'object' || schema === null) return []
  const props = (schema as { properties?: unknown }).properties
  if (typeof props !== 'object' || props === null) return []
  return Object.entries(props as Record<string, unknown>).map(([name, raw]) => ({
    name,
    field: (typeof raw === 'object' && raw !== null ? raw : {}) as FormFieldSchema
  }))
}

function initialValuesFromSchema(schema: unknown): Record<string, ElicitationContentValue> {
  const result: Record<string, ElicitationContentValue> = {}
  for (const { name, field } of extractProperties(schema)) {
    const def = field.default
    if (typeof def === 'string' || typeof def === 'number' || typeof def === 'boolean') {
      result[name] = def
    } else if (Array.isArray(def) && def.every((entry) => typeof entry === 'string')) {
      result[name] = def
    }
  }
  return result
}

export default ElicitationModal
