import { describe, expect, it } from 'vitest'

import {
  nextInspectorView,
  normalizeInspectorView,
  normalizeNarrowTab
} from '../src/renderer/src/stores/ui-store-utils'

describe('normalizeInspectorView', () => {
  it('accepts known values', () => {
    expect(normalizeInspectorView('collapsed')).toBe('collapsed')
    expect(normalizeInspectorView('split')).toBe('split')
    expect(normalizeInspectorView('expanded')).toBe('expanded')
  })

  it('falls back to split for unknown or missing values', () => {
    expect(normalizeInspectorView(undefined)).toBe('split')
    expect(normalizeInspectorView(null)).toBe('split')
    expect(normalizeInspectorView('bogus')).toBe('split')
  })
})

describe('normalizeNarrowTab', () => {
  it('accepts known values', () => {
    expect(normalizeNarrowTab('servers')).toBe('servers')
    expect(normalizeNarrowTab('workspace')).toBe('workspace')
    expect(normalizeNarrowTab('inspector')).toBe('inspector')
  })

  it('falls back to workspace for unknown or missing values', () => {
    expect(normalizeNarrowTab(undefined)).toBe('workspace')
    expect(normalizeNarrowTab('bogus')).toBe('workspace')
  })
})

describe('nextInspectorView', () => {
  it('cycles collapsed → split → expanded → collapsed', () => {
    expect(nextInspectorView('collapsed')).toBe('split')
    expect(nextInspectorView('split')).toBe('expanded')
    expect(nextInspectorView('expanded')).toBe('collapsed')
  })
})
