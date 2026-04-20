import { app, shell, BrowserWindow, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron'
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
  type SessionMessage,
  type SessionMessagesInput,
  type SessionMessagesStreamInput,
  type SessionListInput,
  type DiscoverySessionInput,
  type DiscoveryCallToolInput,
  type DiscoveryReadResourceInput,
  type DiscoveryGetPromptInput
} from '../shared/ipc'
import {
  deleteServerProfile,
  listServerProfiles,
  upsertServerProfile
} from './persistence/serverProfilesRepo'
import { sessionManager } from './mcp/session-manager'
import type { SessionConnectInput, SessionDisconnectInput, SessionStatusInput } from '../shared/ipc'
import { checkForUpdates, initAutoUpdater, quitAndInstall } from './updater'

function buildAppMenu(): Menu {
  const isMac = process.platform === 'darwin'
  const template: MenuItemConstructorOptions[] = []

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Check for Updates…',
          click: () => {
            void checkForUpdates()
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })
  }

  const fileSubmenu: MenuItemConstructorOptions[] = [isMac ? { role: 'close' } : { role: 'quit' }]

  const editSubmenu: MenuItemConstructorOptions[] = [
    { role: 'undo' },
    { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' }
  ]

  if (isMac) {
    editSubmenu.push(
      { role: 'pasteAndMatchStyle' },
      { role: 'delete' },
      { role: 'selectAll' },
      { type: 'separator' },
      {
        label: 'Speech',
        submenu: [{ role: 'startSpeaking' }, { role: 'stopSpeaking' }]
      }
    )
  } else {
    editSubmenu.push({ role: 'delete' }, { type: 'separator' }, { role: 'selectAll' })
  }

  const windowSubmenu: MenuItemConstructorOptions[] = isMac
    ? [{ role: 'front' }, { role: 'close' }]
    : [{ role: 'minimize' }, { role: 'close' }]

  template.push(
    {
      label: 'File',
      submenu: fileSubmenu
    },
    {
      label: 'Edit',
      submenu: editSubmenu
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'window',
      submenu: windowSubmenu
    },
    {
      label: 'Help',
      submenu: [
        ...(isMac
          ? []
          : [
              {
                label: 'Check for Updates…',
                click: () => {
                  void checkForUpdates()
                }
              },
              { type: 'separator' as const }
            ]),
        {
          label: 'Project Repository',
          click: () => {
            void shell.openExternal('https://github.com/modelcontextprotocol')
          }
        },
        {
          label: 'Electron Documentation',
          click: () => {
            void shell.openExternal('https://www.electronjs.org/docs/latest')
          }
        }
      ]
    }
  )

  return Menu.buildFromTemplate(template)
}

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
  Menu.setApplicationMenu(buildAppMenu())

  const messageStreamSubscribers = new Set<number>()
  const pendingMessageBatch: SessionMessage[] = []
  let flushTimer: NodeJS.Timeout | null = null

  const clearFlushTimer = (): void => {
    if (flushTimer !== null) {
      clearTimeout(flushTimer)
      flushTimer = null
    }
  }

  const flushMessageBatch = (): void => {
    clearFlushTimer()

    if (pendingMessageBatch.length === 0 || messageStreamSubscribers.size === 0) {
      pendingMessageBatch.length = 0
      return
    }

    const batch = pendingMessageBatch.splice(0, pendingMessageBatch.length)

    for (const window of BrowserWindow.getAllWindows()) {
      if (!messageStreamSubscribers.has(window.webContents.id) || window.isDestroyed()) {
        continue
      }

      window.webContents.send(IPC_CHANNELS.mcpSessionMessagesStream, batch)
    }
  }

  const scheduleFlush = (): void => {
    if (flushTimer !== null) {
      return
    }

    flushTimer = setTimeout(() => {
      flushMessageBatch()
    }, 100)
  }

  sessionManager.onMessage((message) => {
    pendingMessageBatch.push(message)

    if (pendingMessageBatch.length >= 50) {
      flushMessageBatch()
      return
    }

    scheduleFlush()
  })

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

  ipcMain.handle(
    IPC_CHANNELS.mcpSessionMessagesStream,
    (event, input: SessionMessagesStreamInput) => {
      if (input.enabled) {
        messageStreamSubscribers.add(event.sender.id)
      } else {
        messageStreamSubscribers.delete(event.sender.id)
      }

      event.sender.once('destroyed', () => {
        messageStreamSubscribers.delete(event.sender.id)
      })

      return { ok: true as const }
    }
  )

  ipcMain.handle(IPC_CHANNELS.mcpSessionList, (_, input?: SessionListInput) => {
    return sessionManager.listSessions(input?.limit)
  })

  ipcMain.handle(IPC_CHANNELS.mcpDiscoveryListTools, (_, input: DiscoverySessionInput) => {
    return sessionManager.listTools(input.sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.mcpDiscoveryListResources, (_, input: DiscoverySessionInput) => {
    return sessionManager.listResources(input.sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.mcpDiscoveryListPrompts, (_, input: DiscoverySessionInput) => {
    return sessionManager.listPrompts(input.sessionId)
  })

  ipcMain.handle(IPC_CHANNELS.mcpDiscoveryCallTool, (_, input: DiscoveryCallToolInput) => {
    return sessionManager.callTool(input)
  })

  ipcMain.handle(IPC_CHANNELS.mcpDiscoveryReadResource, (_, input: DiscoveryReadResourceInput) => {
    return sessionManager.readResource(input)
  })

  ipcMain.handle(IPC_CHANNELS.mcpDiscoveryGetPrompt, (_, input: DiscoveryGetPromptInput) => {
    return sessionManager.getPrompt(input)
  })

  ipcMain.handle(IPC_CHANNELS.appCheckForUpdates, () => checkForUpdates())
  ipcMain.handle(IPC_CHANNELS.appInstallUpdate, () => {
    quitAndInstall()
  })

  createWindow()
  initAutoUpdater()

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
  ipcMain.removeHandler(IPC_CHANNELS.mcpSessionMessagesStream)
  ipcMain.removeHandler(IPC_CHANNELS.mcpSessionList)
  ipcMain.removeHandler(IPC_CHANNELS.mcpDiscoveryListTools)
  ipcMain.removeHandler(IPC_CHANNELS.mcpDiscoveryListResources)
  ipcMain.removeHandler(IPC_CHANNELS.mcpDiscoveryListPrompts)
  ipcMain.removeHandler(IPC_CHANNELS.mcpDiscoveryCallTool)
  ipcMain.removeHandler(IPC_CHANNELS.mcpDiscoveryReadResource)
  ipcMain.removeHandler(IPC_CHANNELS.mcpDiscoveryGetPrompt)
  ipcMain.removeHandler(IPC_CHANNELS.appCheckForUpdates)
  ipcMain.removeHandler(IPC_CHANNELS.appInstallUpdate)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
