import { describe, expect, it, vi } from 'vitest'

import {
  InflightOperationsStore,
  type StartInflightOperationInput
} from '../src/main/mcp/session/inflight'

function startInput(
  overrides: Partial<StartInflightOperationInput> = {}
): StartInflightOperationInput {
  return {
    operationId: overrides.operationId ?? 'op-1',
    sessionId: overrides.sessionId ?? 'sess-1',
    kind: overrides.kind ?? 'tool',
    label: overrides.label ?? 'echo',
    controller: overrides.controller ?? new AbortController()
  }
}

describe('InflightOperationsStore', () => {
  it('start() registers the operation and emits change', () => {
    const store = new InflightOperationsStore()
    const onChange = vi.fn()
    store.onChange(onChange)

    const entry = store.start(startInput())

    expect(store.size()).toBe(1)
    expect(store.list()).toHaveLength(1)
    expect(store.list()[0]).toMatchObject({
      operationId: 'op-1',
      sessionId: 'sess-1',
      kind: 'tool',
      label: 'echo'
    })
    expect(entry.startedAt).toEqual(expect.any(String))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('start() rejects duplicate operationId', () => {
    const store = new InflightOperationsStore()
    store.start(startInput())
    expect(() => store.start(startInput())).toThrowError(/Duplicate inflight operationId/)
  })

  it('recordProgress() updates lastProgress and emits change', () => {
    const store = new InflightOperationsStore()
    store.start(startInput())
    const onChange = vi.fn()
    store.onChange(onChange)

    const ok = store.recordProgress('op-1', {
      progress: 5,
      total: 10,
      message: 'halfway',
      at: '2026-01-01T00:00:00.000Z'
    })

    expect(ok).toBe(true)
    expect(store.list()[0]?.lastProgress).toEqual({
      progress: 5,
      total: 10,
      message: 'halfway',
      at: '2026-01-01T00:00:00.000Z'
    })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('recordProgress() returns false for unknown operationId', () => {
    const store = new InflightOperationsStore()
    expect(store.recordProgress('missing', { progress: 1, at: 'now' })).toBe(false)
  })

  it('complete() removes the operation and emits change', () => {
    const store = new InflightOperationsStore()
    store.start(startInput())
    const onChange = vi.fn()
    store.onChange(onChange)

    expect(store.complete('op-1')).toBe(true)
    expect(store.size()).toBe(0)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('cancel() aborts the controller, removes the entry, and emits change', () => {
    const store = new InflightOperationsStore()
    const controller = new AbortController()
    store.start(startInput({ controller }))
    const onChange = vi.fn()
    store.onChange(onChange)

    const ok = store.cancel('op-1', 'user-cancel')

    expect(ok).toBe(true)
    expect(controller.signal.aborted).toBe(true)
    expect(store.size()).toBe(0)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('cancel() returns false for unknown operationId', () => {
    const store = new InflightOperationsStore()
    expect(store.cancel('missing')).toBe(false)
  })

  it('rejectBySession() aborts and drops entries for the session only', () => {
    const store = new InflightOperationsStore()
    const controllerA = new AbortController()
    const controllerB = new AbortController()
    const controllerC = new AbortController()
    store.start(startInput({ operationId: 'a', sessionId: 's1', controller: controllerA }))
    store.start(startInput({ operationId: 'b', sessionId: 's1', controller: controllerB }))
    store.start(startInput({ operationId: 'c', sessionId: 's2', controller: controllerC }))

    const onChange = vi.fn()
    store.onChange(onChange)

    store.rejectBySession('s1', 'Session disconnected')

    expect(controllerA.signal.aborted).toBe(true)
    expect(controllerB.signal.aborted).toBe(true)
    expect(controllerC.signal.aborted).toBe(false)
    expect(store.size()).toBe(1)
    expect(store.list()[0]?.operationId).toBe('c')
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('rejectBySession() with no matching entries does not emit', () => {
    const store = new InflightOperationsStore()
    store.start(startInput({ sessionId: 's1' }))
    const onChange = vi.fn()
    store.onChange(onChange)

    store.rejectBySession('other', 'no-op')

    expect(onChange).not.toHaveBeenCalled()
  })

  it('list() projects only summary fields (no controller)', () => {
    const store = new InflightOperationsStore()
    store.start(startInput())
    const summary = store.list()[0]
    expect(summary).not.toHaveProperty('controller')
    expect(summary).toMatchObject({
      operationId: 'op-1',
      sessionId: 'sess-1',
      kind: 'tool',
      label: 'echo'
    })
  })
})
