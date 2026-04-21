export type InspectorView = 'collapsed' | 'split' | 'expanded'
export type NarrowTab = 'servers' | 'workspace' | 'inspector'

const INSPECTOR_VIEWS: readonly InspectorView[] = ['collapsed', 'split', 'expanded']
const NARROW_TABS: readonly NarrowTab[] = ['servers', 'workspace', 'inspector']

export const normalizeInspectorView = (value: unknown): InspectorView => {
  return INSPECTOR_VIEWS.includes(value as InspectorView) ? (value as InspectorView) : 'split'
}

export const normalizeNarrowTab = (value: unknown): NarrowTab => {
  return NARROW_TABS.includes(value as NarrowTab) ? (value as NarrowTab) : 'workspace'
}

export const nextInspectorView = (current: InspectorView): InspectorView => {
  const index = INSPECTOR_VIEWS.indexOf(current)
  const nextIndex = (index + 1) % INSPECTOR_VIEWS.length
  return INSPECTOR_VIEWS[nextIndex] ?? 'split'
}
