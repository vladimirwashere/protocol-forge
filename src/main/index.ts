import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { APP_NAME, APP_VERSION } from '../shared/constants'
import {
  IPC_CHANNELS,
  type AppMeta,
  type PingResponse,
  type DeleteServerProfileInput,
  type UpsertServerProfileInput,
  type SessionMessagesInput
} from '../shared/ipc'
import {
  deleteServerProfile,
  listServerProfiles,
  upsertServerProfile
} from './persistence/serverProfilesRepo'
import { sessionManager } from './mcp/session-manager'
import type { SessionConnectInput, SessionDisconnectInput, SessionStatusInput } from '../shared/ipc'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
      devTools: is.dev
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle(IPC_CHANNELS.appGetMeta, (): AppMeta => {
    return {
      name: APP_NAME,
      version: APP_VERSION,
      platform: process.platform
    }
  })

  ipcMain.handle(IPC_CHANNELS.appPing, (): PingResponse => {
    return {
      ok: true,
      at: new Date().toISOString()
    }
  })

  ipcMain.handle(IPC_CHANNELS.serverProfilesList, () => {
    return listServerProfiles()
  })

  ipcMain.handle(IPC_CHANNELS.serverProfilesUpsert, (_, input: UpsertServerProfileInput) => {
    return upsertServerProfile(input)
  })

  ipcMain.handle(IPC_CHANNELS.serverProfilesDelete, (_, input: DeleteServerProfileInput) => {
    return deleteServerProfile(input)
  })

  ipcMain.handle(IPC_CHANNELS.mcpSessionConnect, (_, input: SessionConnectInput) => {
    return sessionManager.connect(input)
  })

  ipcMain.handle(IPC_CHANNELS.mcpSessionDisconnect, (_, input: SessionDisconnectInput) => {
    return sessionManager.disconnect(input)
  })

  ipcMain.handle(IPC_CHANNELS.mcpSessionStatus, (_, input: SessionStatusInput) => {
    return sessionManager.getStatus(input.sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.mcpSessionMessages, (_, input: SessionMessagesInput) => {
    return sessionManager.getMessages(input.sessionId, input.limit)
  })

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  void sessionManager.shutdown()
  ipcMain.removeHandler(IPC_CHANNELS.appGetMeta)
  ipcMain.removeHandler(IPC_CHANNELS.appPing)
  ipcMain.removeHandler(IPC_CHANNELS.serverProfilesList)
  ipcMain.removeHandler(IPC_CHANNELS.serverProfilesUpsert)
  ipcMain.removeHandler(IPC_CHANNELS.serverProfilesDelete)
  ipcMain.removeHandler(IPC_CHANNELS.mcpSessionConnect)
  ipcMain.removeHandler(IPC_CHANNELS.mcpSessionDisconnect)
  ipcMain.removeHandler(IPC_CHANNELS.mcpSessionStatus)
  ipcMain.removeHandler(IPC_CHANNELS.mcpSessionMessages)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
