export type OutputSchemaValidationError = {
  path: string
  message: string
}

export type OutputSchemaValidationResult =
  | { ok: true }
  | { ok: false; errors: OutputSchemaValidationError[] }

type SchemaNode = {
  type?: string | string[]
  properties?: Record<string, SchemaNode>
  required?: unknown
  enum?: unknown[]
  items?: SchemaNode
}

const PRIMITIVE_TYPE_CHECKS: Record<string, (value: unknown) => boolean> = {
  string: (value) => typeof value === 'string',
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  integer: (value) => typeof value === 'number' && Number.isInteger(value),
  boolean: (value) => typeof value === 'boolean',
  null: (value) => value === null
}

const joinPath = (parent: string, segment: string | number): string => {
  if (typeof segment === 'number') return `${parent}[${segment}]`
  return parent.length === 0 ? segment : `${parent}.${segment}`
}

const checkPrimitive = (
  type: string,
  value: unknown,
  path: string,
  errors: OutputSchemaValidationError[]
): void => {
  const check = PRIMITIVE_TYPE_CHECKS[type]
  if (!check) return
  if (!check(value)) {
    errors.push({ path: path || '$', message: `expected ${type}` })
  }
}

const validateEnum = (
  enumValues: unknown[],
  value: unknown,
  path: string,
  errors: OutputSchemaValidationError[]
): void => {
  if (!enumValues.includes(value)) {
    errors.push({
      path: path || '$',
      message: `value is not in enum: ${enumValues.map((v) => JSON.stringify(v)).join(', ')}`
    })
  }
}

const validateAgainst = (
  schema: SchemaNode,
  value: unknown,
  path: string,
  errors: OutputSchemaValidationError[]
): void => {
  const type = schema.type

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    validateEnum(schema.enum, value, path, errors)
  }

  if (type === 'object' || (type === undefined && schema.properties)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push({ path: path || '$', message: 'expected object' })
      return
    }
    const record = value as Record<string, unknown>
    const required = Array.isArray(schema.required)
      ? schema.required.filter((entry): entry is string => typeof entry === 'string')
      : []
    for (const key of required) {
      if (!(key in record)) {
        errors.push({ path: joinPath(path, key), message: 'required field is missing' })
      }
    }
    const properties = schema.properties ?? {}
    for (const [key, childSchema] of Object.entries(properties)) {
      if (!(key in record)) continue
      validateAgainst(childSchema, record[key], joinPath(path, key), errors)
    }
    return
  }

  if (type === 'array') {
    if (!Array.isArray(value)) {
      errors.push({ path: path || '$', message: 'expected array' })
      return
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i += 1) {
        validateAgainst(schema.items, value[i], joinPath(path, i), errors)
      }
    }
    return
  }

  if (typeof type === 'string') {
    checkPrimitive(type, value, path, errors)
    return
  }

  if (Array.isArray(type)) {
    const matchedAny = type.some((candidate) => {
      const localErrors: OutputSchemaValidationError[] = []
      validateAgainst({ ...schema, type: candidate }, value, path, localErrors)
      return localErrors.length === 0
    })
    if (!matchedAny) {
      errors.push({ path: path || '$', message: `expected one of ${type.join(' | ')}` })
    }
  }
}

export function validateAgainstOutputSchema(
  schema: unknown,
  value: unknown
): OutputSchemaValidationResult {
  if (schema === null || typeof schema !== 'object') {
    return { ok: true }
  }
  const errors: OutputSchemaValidationError[] = []
  validateAgainst(schema as SchemaNode, value, '', errors)
  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}
