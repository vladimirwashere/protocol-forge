import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS, type AppApi } from '../shared/ipc'

// Custom APIs for renderer
const api: AppApi = {
  getAppMeta: () => ipcRenderer.invoke(IPC_CHANNELS.appGetMeta),
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.appPing),
  listServerProfiles: () => ipcRenderer.invoke(IPC_CHANNELS.serverProfilesList),
  upsertServerProfile: (input) => ipcRenderer.invoke(IPC_CHANNELS.serverProfilesUpsert, input),
  deleteServerProfile: (input) => ipcRenderer.invoke(IPC_CHANNELS.serverProfilesDelete, input),
  connectSession: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpSessionConnect, input),
  disconnectSession: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpSessionDisconnect, input),
  getSessionStatus: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpSessionStatus, input),
  getSessionMessages: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpSessionMessages, input),
  subscribeSessionMessages: (listener) => {
    const handler = (_event: unknown, messages: Parameters<typeof listener>[0]): void => {
      listener(messages)
    }

    ipcRenderer.on(IPC_CHANNELS.mcpSessionMessagesStream, handler)
    void ipcRenderer.invoke(IPC_CHANNELS.mcpSessionMessagesStream, { enabled: true })

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.mcpSessionMessagesStream, handler)
      void ipcRenderer.invoke(IPC_CHANNELS.mcpSessionMessagesStream, { enabled: false })
    }
  },
  listSessions: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpSessionList, input),
  listTools: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpDiscoveryListTools, input),
  listResources: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpDiscoveryListResources, input),
  listPrompts: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpDiscoveryListPrompts, input),
  callTool: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpDiscoveryCallTool, input),
  readResource: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpDiscoveryReadResource, input),
  getPrompt: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpDiscoveryGetPrompt, input),
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.appCheckForUpdates),
  installUpdate: () => ipcRenderer.invoke(IPC_CHANNELS.appInstallUpdate),
  subscribeUpdateStatus: (listener) => {
    const handler = (_event: unknown, status: Parameters<typeof listener>[0]): void => {
      listener(status)
    }

    ipcRenderer.on(IPC_CHANNELS.appUpdateStatusStream, handler)

    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.appUpdateStatusStream, handler)
    }
  }
}

const electronBridge = {
  process: {
    versions: process.versions
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronBridge)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronBridge
  // @ts-ignore (define in dts)
  window.api = api
}
