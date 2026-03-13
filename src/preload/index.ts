import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
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
  listSessions: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpSessionList, input),
  listTools: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpDiscoveryListTools, input),
  listResources: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpDiscoveryListResources, input),
  listPrompts: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpDiscoveryListPrompts, input),
  callTool: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpDiscoveryCallTool, input),
  readResource: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpDiscoveryReadResource, input),
  getPrompt: (input) => ipcRenderer.invoke(IPC_CHANNELS.mcpDiscoveryGetPrompt, input)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
