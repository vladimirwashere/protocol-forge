import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import {
  nextInspectorView,
  normalizeInspectorView,
  normalizeNarrowTab,
  type InspectorView,
  type NarrowTab
} from './ui-store-utils'

type UIStoreState = {
  metaText: string
  inspectorView: InspectorView
  narrowTab: NarrowTab
  setMetaText: (value: string) => void
  setInspectorView: (value: InspectorView) => void
  cycleInspectorView: () => void
  setNarrowTab: (value: NarrowTab) => void
  hydrateMeta: () => Promise<void>
}

export const useUIStore = create<UIStoreState>()(
  persist(
    (set, get) => ({
      metaText: 'Loading runtime metadata...',
      inspectorView: 'split',
      narrowTab: 'workspace',

      setMetaText: (value) => {
        set({ metaText: value })
      },

      setInspectorView: (value) => {
        set({ inspectorView: normalizeInspectorView(value) })
      },

      cycleInspectorView: () => {
        set({ inspectorView: nextInspectorView(get().inspectorView) })
      },

      setNarrowTab: (value) => {
        set({ narrowTab: normalizeNarrowTab(value) })
      },

      hydrateMeta: async () => {
        try {
          const [meta, ping] = await Promise.all([window.api.getAppMeta(), window.api.ping()])
          set({
            metaText: `${meta.name} v${meta.version} on ${meta.platform} (ipc ok: ${ping.ok ? 'yes' : 'no'})`
          })
        } catch {
          set({ metaText: 'IPC unavailable' })
        }
      }
    }),
    {
      name: 'protocol-forge-ui-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        inspectorView: state.inspectorView,
        narrowTab: state.narrowTab
      }),
      merge: (persistedState, currentState) => {
        const maybeState = (persistedState ?? {}) as Partial<UIStoreState>
        return {
          ...currentState,
          ...maybeState,
          inspectorView: normalizeInspectorView(maybeState.inspectorView),
          narrowTab: normalizeNarrowTab(maybeState.narrowTab)
        }
      }
    }
  )
)
