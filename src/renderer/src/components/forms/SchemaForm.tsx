import { useEffect, useMemo, useState } from 'react'
import { type JsonSchemaInput, parseSchemaFormValues } from './schema-form-utils'

type SchemaFormProps = {
  schema: Record<string, unknown>
  submitLabel: string
  disabled?: boolean
  onSubmit: (args: Record<string, unknown>) => void
}

function SchemaForm({
  schema,
  submitLabel,
  disabled = false,
  onSubmit
}: SchemaFormProps): React.JSX.Element {
  const typedSchema = schema as JsonSchemaInput
  const properties = typedSchema.properties ?? {}

  const initialValues = useMemo(() => {
    const sourceProperties = (schema as JsonSchemaInput).properties ?? {}
    const seed: Record<string, string> = {}

    for (const [key, property] of Object.entries(sourceProperties)) {
      if (property.type === 'boolean') {
        seed[key] = 'false'
      } else if (property.type === 'array') {
        seed[key] = ''
      } else {
        seed[key] = ''
      }
    }

    return seed
  }, [schema])

  const [values, setValues] = useState<Record<string, string>>(initialValues)

  useEffect(() => {
    setValues(initialValues)
  }, [initialValues])

  const required = new Set(typedSchema.required ?? [])

  const hasFields = Object.keys(properties).length > 0

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()

    onSubmit(parseSchemaFormValues(values, typedSchema))
  }

  if (!hasFields) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          onSubmit({})
        }}
        className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
      >
        {submitLabel}
      </button>
    )
  }

  return (
    <form className="space-y-2" onSubmit={handleSubmit}>
      {Object.entries(properties).map(([key, property]) => {
        const type = property.type
        const label = property.title ?? key

        if (type === 'boolean') {
          return (
            <label key={key} className="block text-xs text-slate-300">
              <span className="mb-1 block font-medium">
                {label}
                {required.has(key) ? ' *' : ''}
              </span>
              <select
                value={values[key] ?? 'false'}
                onChange={(event) => {
                  const value = event.target.value
                  setValues((current) => ({ ...current, [key]: value }))
                }}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              >
                <option value="false">false</option>
                <option value="true">true</option>
              </select>
            </label>
          )
        }

        if (type === 'array') {
          return (
            <label key={key} className="block text-xs text-slate-300">
              <span className="mb-1 block font-medium">
                {label}
                {required.has(key) ? ' *' : ''}
              </span>
              <textarea
                value={values[key] ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  setValues((current) => ({ ...current, [key]: value }))
                }}
                rows={3}
                placeholder="One value per line"
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              />
            </label>
          )
        }

        if (Array.isArray(property.enum) && property.enum.length > 0) {
          return (
            <label key={key} className="block text-xs text-slate-300">
              <span className="mb-1 block font-medium">
                {label}
                {required.has(key) ? ' *' : ''}
              </span>
              <select
                value={values[key] ?? ''}
                onChange={(event) => {
                  const value = event.target.value
                  setValues((current) => ({ ...current, [key]: value }))
                }}
                className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
              >
                <option value="">Select…</option>
                {property.enum.map((option) => {
                  const optionValue = String(option)
                  return (
                    <option key={optionValue} value={optionValue}>
                      {optionValue}
                    </option>
                  )
                })}
              </select>
            </label>
          )
        }

        return (
          <label key={key} className="block text-xs text-slate-300">
            <span className="mb-1 block font-medium">
              {label}
              {required.has(key) ? ' *' : ''}
            </span>
            <input
              value={values[key] ?? ''}
              onChange={(event) => {
                const value = event.target.value
                setValues((current) => ({ ...current, [key]: value }))
              }}
              placeholder={property.description ?? ''}
              className="w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs"
            />
          </label>
        )
      })}

      <button
        type="submit"
        disabled={disabled}
        className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-200 disabled:opacity-60"
      >
        {submitLabel}
      </button>
    </form>
  )
}

export default SchemaForm
