export type PrimitiveType = 'string' | 'number' | 'integer' | 'boolean'

export type JsonSchemaProperty = {
  type?: PrimitiveType | PrimitiveType[] | 'array'
  title?: string
  description?: string
  enum?: unknown[]
  items?: {
    type?: PrimitiveType
  }
}

export type JsonSchemaInput = {
  type?: string
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
}

export const parseArrayValue = (raw: string, itemType?: PrimitiveType): unknown[] => {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (itemType === 'number' || itemType === 'integer') {
    return lines.map((line) => {
      const parsed = Number(line)
      return Number.isNaN(parsed) ? line : parsed
    })
  }

  if (itemType === 'boolean') {
    return lines.map((line) => line.toLowerCase() === 'true')
  }

  return lines
}

export const parseSchemaFormValues = (
  values: Record<string, string>,
  schema: JsonSchemaInput
): Record<string, unknown> => {
  const properties = schema.properties ?? {}
  const required = new Set(schema.required ?? [])
  const parsed: Record<string, unknown> = {}

  for (const [key, property] of Object.entries(properties)) {
    const rawValue = values[key] ?? ''
    const trimmed = rawValue.trim()

    if (trimmed.length === 0 && !required.has(key)) {
      continue
    }

    if (property.type === 'number' || property.type === 'integer') {
      const numeric = Number(trimmed)
      parsed[key] = Number.isNaN(numeric) ? trimmed : numeric
      continue
    }

    if (property.type === 'boolean') {
      parsed[key] = trimmed.toLowerCase() === 'true'
      continue
    }

    if (property.type === 'array') {
      parsed[key] = parseArrayValue(trimmed, property.items?.type)
      continue
    }

    parsed[key] = trimmed
  }

  return parsed
}
