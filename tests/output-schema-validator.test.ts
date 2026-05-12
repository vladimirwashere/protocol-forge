import { describe, expect, it } from 'vitest'

import { validateAgainstOutputSchema } from '../src/renderer/src/components/results/output-schema-validator'

describe('validateAgainstOutputSchema', () => {
  it('returns ok when the schema is not an object', () => {
    expect(validateAgainstOutputSchema(null, { anything: true })).toEqual({ ok: true })
    expect(validateAgainstOutputSchema('not a schema', {})).toEqual({ ok: true })
  })

  it('passes for a valid object against a typical tool output schema', () => {
    const schema = {
      type: 'object',
      properties: {
        result: { type: 'string' },
        count: { type: 'integer' },
        ok: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['result', 'count']
    }
    const result = validateAgainstOutputSchema(schema, {
      result: 'done',
      count: 3,
      ok: true,
      tags: ['a', 'b']
    })
    expect(result).toEqual({ ok: true })
  })

  it('reports missing required fields with paths', () => {
    const schema = {
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'string' } },
      required: ['a', 'b']
    }
    const result = validateAgainstOutputSchema(schema, { a: 'x' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual([{ path: 'b', message: 'required field is missing' }])
  })

  it('rejects wrong primitive type', () => {
    const schema = {
      type: 'object',
      properties: { count: { type: 'integer' } },
      required: ['count']
    }
    const result = validateAgainstOutputSchema(schema, { count: 'not-a-number' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual([{ path: 'count', message: 'expected integer' }])
  })

  it('rejects a non-integer number for integer fields', () => {
    const schema = {
      type: 'object',
      properties: { n: { type: 'integer' } }
    }
    const result = validateAgainstOutputSchema(schema, { n: 1.5 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]?.path).toBe('n')
  })

  it('enforces enum constraints', () => {
    const schema = {
      type: 'object',
      properties: { color: { type: 'string', enum: ['red', 'green', 'blue'] } }
    }
    expect(validateAgainstOutputSchema(schema, { color: 'red' })).toEqual({ ok: true })
    const bad = validateAgainstOutputSchema(schema, { color: 'yellow' })
    expect(bad.ok).toBe(false)
  })

  it('rejects non-objects when the schema expects an object', () => {
    const schema = { type: 'object', properties: {} }
    const result = validateAgainstOutputSchema(schema, ['array', 'not', 'object'])
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]?.message).toBe('expected object')
  })

  it('validates array items', () => {
    const schema = {
      type: 'object',
      properties: { ns: { type: 'array', items: { type: 'integer' } } }
    }
    const result = validateAgainstOutputSchema(schema, { ns: [1, 'two', 3] })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual([{ path: 'ns[1]', message: 'expected integer' }])
  })

  it('supports union types via type arrays', () => {
    const schema = {
      type: 'object',
      properties: { value: { type: ['string', 'null'] } }
    }
    expect(validateAgainstOutputSchema(schema, { value: 'ok' })).toEqual({ ok: true })
    expect(validateAgainstOutputSchema(schema, { value: null })).toEqual({ ok: true })
    expect(validateAgainstOutputSchema(schema, { value: 42 }).ok).toBe(false)
  })

  it('treats unknown property fields as opaque (no error when extra keys are present)', () => {
    const schema = {
      type: 'object',
      properties: { known: { type: 'string' } }
    }
    expect(
      validateAgainstOutputSchema(schema, { known: 'x', extra: 'allowed', another: 42 })
    ).toEqual({ ok: true })
  })

  it('accumulates multiple errors', () => {
    const schema = {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'integer' }
      },
      required: ['a', 'b']
    }
    const result = validateAgainstOutputSchema(schema, { a: 1, b: 'two' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toEqual([
      { path: 'a', message: 'expected string' },
      { path: 'b', message: 'expected integer' }
    ])
  })
})
