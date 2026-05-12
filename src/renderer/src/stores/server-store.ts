import { create } from 'zustand'
import type { ProfileRoot, ServerProfile, UpsertServerProfileInput } from '../../../shared/ipc'

import { parseHttpHeadersRaw, parseRootsRaw, parseStdioArgsRaw } from './server-store-utils'

export type ProfileTransport = 'stdio' | 'streamable-http'

export type ServerFormState = {
  name: string
  transport: ProfileTransport
  command: string
  argsRaw: string
  cwd: string
  httpUrl: string
  httpHeadersRaw: string
  rootsRaw: string
}

type ServerStoreState = {
  profiles: ServerProfile[]
  form: ServerFormState
  saveError: string | null
  setFormField: <K extends keyof ServerFormState>(field: K, value: ServerFormState[K]) => void
  resetForm: () => void
  refreshProfiles: () => Promise<void>
  saveProfile: () => Promise<void>
  deleteProfile: (id: string) => Promise<void>
  updateProfileRoots: (profileId: string, rootsRaw: string) => Promise<void>
}

const defaultFormState = (): ServerFormState => ({
  name: '',
  transport: 'stdio',
  command: 'npx',
  argsRaw: '',
  cwd: '',
  httpUrl: '',
  httpHeadersRaw: '',
  rootsRaw: ''
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
      const httpUrl = form.httpUrl.trim()

      const roots = parseRootsRaw(form.rootsRaw)
      const payload: UpsertServerProfileInput =
        form.transport === 'stdio'
          ? {
              name: form.name,
              transport: 'stdio',
              command,
              args,
              cwd,
              roots
            }
          : {
              name: form.name,
              transport: 'streamable-http',
              url: httpUrl,
              headers: parseHttpHeadersRaw(form.httpHeadersRaw),
              roots
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

  deleteProfile: async (id) => {
    await window.api.deleteServerProfile({ id })
    await get().refreshProfiles()
  },

  updateProfileRoots: async (profileId, rootsRaw) => {
    const profile = get().profiles.find((entry) => entry.id === profileId)
    if (!profile) throw new Error('Profile not found')

    const roots: ProfileRoot[] = parseRootsRaw(rootsRaw)
    const payload: UpsertServerProfileInput =
      profile.transport === 'stdio'
        ? {
            id: profile.id,
            name: profile.name,
            transport: 'stdio',
            command: profile.command ?? '',
            args: profile.args ?? [],
            cwd: profile.cwd ?? '',
            roots
          }
        : {
            id: profile.id,
            name: profile.name,
            transport: 'streamable-http',
            url: profile.url ?? '',
            headers: profile.headers ?? {},
            roots
          }

    await window.api.upsertServerProfile(payload)
    await get().refreshProfiles()
  }
}))
