export const IPC_CHANNELS = {
  appGetMeta: 'app:get-meta',
  appPing: 'app:ping',
  serverProfilesList: 'server-profiles:list',
  serverProfilesUpsert: 'server-profiles:upsert',
  serverProfilesDelete: 'server-profiles:delete'
} as const

export type AppMeta = {
  name: string
  version: string
  platform: NodeJS.Platform
}

export type PingResponse = {
  ok: true
  at: string
}

export type ServerProfile = {
  id: string
  name: string
  command: string
  args: string[]
  cwd: string
  createdAt: string
  updatedAt: string
}

export type UpsertServerProfileInput = {
  id?: string
  name: string
  command: string
  args: string[]
  cwd: string
}

export type DeleteServerProfileInput = {
  id: string
}

export type AppApi = {
  getAppMeta: () => Promise<AppMeta>
  ping: () => Promise<PingResponse>
  listServerProfiles: () => Promise<ServerProfile[]>
  upsertServerProfile: (input: UpsertServerProfileInput) => Promise<ServerProfile>
  deleteServerProfile: (input: DeleteServerProfileInput) => Promise<{ ok: true }>
}
