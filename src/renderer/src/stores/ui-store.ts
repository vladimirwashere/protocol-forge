import { create } from 'zustand'

type UIStoreState = {
  metaText: string
  inspectorHeight: number
  setMetaText: (value: string) => void
  setInspectorHeight: (value: number) => void
  hydrateMeta: () => Promise<void>
}

export const useUIStore = create<UIStoreState>((set) => ({
  metaText: 'Loading runtime metadata...',
  inspectorHeight: 220,

  setMetaText: (value) => {
    set({ metaText: value })
  },

  setInspectorHeight: (value) => {
    const clamped = Math.max(160, Math.min(520, Math.round(value)))
    set({ inspectorHeight: clamped })
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
}))
