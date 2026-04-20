import { describe, expect, it } from 'vitest'

import { applyStatusTransition } from '../src/renderer/src/stores/update-store'

describe('applyStatusTransition', () => {
  it('emits a toast on transition to available', () => {
    const result = applyStatusTransition(
      { state: 'idle' },
      { state: 'available', version: '0.1.2' }
    )
    expect(result.toast?.kind).toBe('available')
  })

  it('emits a toast on transition to downloaded', () => {
    const result = applyStatusTransition(
      { state: 'downloading', percent: 50 },
      { state: 'downloaded', version: '0.1.2' }
    )
    expect(result.toast?.kind).toBe('downloaded')
  })

  it('emits a toast on first error', () => {
    const result = applyStatusTransition({ state: 'checking' }, { state: 'error', message: 'boom' })
    expect(result.toast?.kind).toBe('error')
  })

  it('does not re-emit when staying in the same error state', () => {
    const result = applyStatusTransition(
      { state: 'error', message: 'boom' },
      { state: 'error', message: 'boom again' }
    )
    expect(result.toast).toBeUndefined()
  })

  it('does not emit for neutral transitions', () => {
    expect(applyStatusTransition({ state: 'idle' }, { state: 'checking' }).toast).toBeUndefined()
    expect(
      applyStatusTransition({ state: 'checking' }, { state: 'not-available' }).toast
    ).toBeUndefined()
  })
})
