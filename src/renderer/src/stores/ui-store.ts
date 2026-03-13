import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import { clampInspectorHeight } from './ui-store-utils'

type UIStoreState = {
  metaText: string
  inspectorHeight: number
  setMetaText: (value: string) => void
  setInspectorHeight: (value: number) => void
  hydrateMeta: () => Promise<void>
}

export const useUIStore = create<UIStoreState>()(
  persist(
    (set) => ({
      metaText: 'Loading runtime metadata...',
      inspectorHeight: 220,

      setMetaText: (value) => {
        set({ metaText: value })
      },

      setInspectorHeight: (value) => {
        set({ inspectorHeight: clampInspectorHeight(value) })
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
      name: 'mcp-scope-ui-preferences',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        inspectorHeight: state.inspectorHeight
      }),
      merge: (persistedState, currentState) => {
        const maybeState = persistedState as Partial<UIStoreState>
        const inspectorHeight =
          typeof maybeState.inspectorHeight === 'number'
            ? clampInspectorHeight(maybeState.inspectorHeight)
            : currentState.inspectorHeight

        return {
          ...currentState,
          ...maybeState,
          inspectorHeight
        }
      }
    }
  )
)
