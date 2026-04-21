import type { AppApi } from '../../shared/ipc'

export function installIpcFallback(): void {
  if (typeof window === 'undefined' || window.api) {
    return
  }

  const notAvailable = (): Promise<never> =>
    Promise.reject(new Error('IPC not available (renderer loaded outside Electron)'))

  const fallback: AppApi = {
    getAppMeta: () =>
      Promise.resolve({ name: 'Protocol Forge', version: 'dev', platform: 'linux' }),
    ping: () => Promise.resolve({ ok: true, at: new Date().toISOString() }),
    listServerProfiles: () => Promise.resolve([]),
    upsertServerProfile: notAvailable,
    deleteServerProfile: notAvailable,
    connectSession: notAvailable,
    disconnectSession: notAvailable,
    getSessionStatus: notAvailable,
    getSessionMessages: notAvailable,
    subscribeSessionMessages: () => () => {},
    listSessions: () => Promise.resolve([]),
    listTools: () => Promise.resolve({ tools: [] }),
    listResources: () => Promise.resolve({ resources: [] }),
    listPrompts: () => Promise.resolve({ prompts: [] }),
    callTool: notAvailable,
    readResource: notAvailable,
    getPrompt: notAvailable,
    checkForUpdates: () => Promise.resolve(),
    installUpdate: () => Promise.resolve(),
    subscribeUpdateStatus: () => () => {}
  }

  Object.defineProperty(window, 'api', { value: fallback, writable: false, configurable: false })
}
