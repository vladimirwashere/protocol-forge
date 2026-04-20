import { create } from 'zustand'
import type { ServerProfile, UpsertServerProfileInput } from '../../../shared/ipc'

import { parseSseHeadersRaw, parseStdioArgsRaw } from './server-store-utils'

export type ProfileTransport = 'stdio' | 'streamable-http'

export type ServerFormState = {
  name: string
  transport: ProfileTransport
  command: string
  argsRaw: string
  cwd: string
  sseUrl: string
  sseHeadersRaw: string
}

type ServerStoreState = {
  profiles: ServerProfile[]
  form: ServerFormState
  saveError: string | null
  setFormField: <K extends keyof ServerFormState>(field: K, value: ServerFormState[K]) => void
  resetForm: () => void
  refreshProfiles: () => Promise<void>
  saveProfile: () => Promise<void>
  convertLegacySseProfile: (profile: ServerProfile) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
}

const defaultFormState = (): ServerFormState => ({
  name: '',
  transport: 'stdio',
  command: 'npx',
  argsRaw: '',
  cwd: '',
  sseUrl: '',
  sseHeadersRaw: ''
})

export const useServerStore = create<ServerStoreState>((set, get) => ({
  profiles: [],
  form: defaultFormState(),
  saveError: null,

  setFormField: (field, value) => {
    set((state) => ({
      form: {
        ...state.form,
        [field]: value
      }
    }))
  },

  resetForm: () => {
    set({
      form: defaultFormState()
    })
  },

  refreshProfiles: async () => {
    const profiles = await window.api.listServerProfiles()
    set({ profiles })
  },

  saveProfile: async () => {
    set({ saveError: null })

    try {
      const { form } = get()
      const args = parseStdioArgsRaw(form.argsRaw)
      const command = form.command.trim()
      const cwd = form.cwd.trim()
      const sseUrl = form.sseUrl.trim()

      const payload: UpsertServerProfileInput =
        form.transport === 'stdio'
          ? {
              name: form.name,
              transport: 'stdio',
              command,
              args,
              cwd
            }
          : {
              name: form.name,
              transport: 'streamable-http',
              url: sseUrl,
              headers: parseSseHeadersRaw(form.sseHeadersRaw)
            }

      await window.api.upsertServerProfile(payload)
      await get().refreshProfiles()

      set({
        form: {
          ...defaultFormState(),
          command: form.command
        }
      })
    } catch (error) {
      set({
        saveError: error instanceof Error ? error.message : 'Failed to save profile'
      })
    }
  },

  convertLegacySseProfile: async (profile) => {
    if (profile.transport !== 'sse') {
      return
    }

    set({ saveError: null })

    try {
      await window.api.upsertServerProfile({
        id: profile.id,
        name: profile.name,
        transport: 'streamable-http',
        url: (profile.url ?? '').trim(),
        headers: profile.headers ?? {}
      })

      await get().refreshProfiles()
    } catch (error) {
      set({
        saveError: error instanceof Error ? error.message : 'Failed to convert legacy SSE profile'
      })
    }
  },

  deleteProfile: async (id) => {
    await window.api.deleteServerProfile({ id })
    await get().refreshProfiles()
  }
}))
