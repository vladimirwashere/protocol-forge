import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Menu,
  safeStorage,
  type MenuItemConstructorOptions
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { APP_NAME, APP_VERSION } from '../shared/constants'
import {
  IPC_CHANNELS,
  type AppMeta,
  type DiscoveryCallToolInput,
  type DiscoveryGetPromptInput,
  type ElicitationPendingRequest,
  type InflightOperationSummary,
  type PingResponse,
  type SamplingPendingRequest,
  type SessionConnectInput,
  type SessionMessage,
  type UpsertServerProfileInput
} from '../shared/ipc'
import {
  deleteServerProfile,
  listServerProfiles,
  upsertServerProfile
} from './persistence/serverProfilesRepo'
import { sessionManager } from './mcp/session-manager'
import { checkForUpdates, initAutoUpdater, quitAndInstall } from './updater'
import { fixEnvPath } from './fix-env-path'
import { initSafeStorage } from './security/safe-storage'
import { initDatabase } from './persistence/database'
import { registerIpcHandler, registerIpcHandlerNoInput } from './ipc/register'
import {
  deleteServerProfileSchema,
  discoveryCallToolSchema,
  discoveryGetPromptSchema,
  discoveryReadResourceSchema,
  discoverySessionSchema,
  elicitationListPendingSchema,
  elicitationRespondSchema,
  elicitationStreamSchema,
  inflightCancelSchema,
  inflightListSchema,
  inflightStreamSchema,
  samplingListPendingSchema,
  samplingRejectSchema,
  samplingRespondSchema,
  samplingStreamSchema,
  sessionConnectSchema,
  sessionDisconnectSchema,
  sessionListSchema,
  sessionMessagesSchema,
  sessionMessagesStreamSchema,
  sessionStatusSchema,
  upsertServerProfileSchema
} from './ipc/schemas'

fixEnvPath()

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
  // Order matters: initDatabase runs migratePlaintextHeaders, which calls canEncrypt().
  initSafeStorage({
    canEncrypt: () => safeStorage.isEncryptionAvailable(),
    encryptString: (plain) => safeStorage.encryptString(plain),
    decryptString: (buf) => safeStorage.decryptString(buf)
  })
  initDatabase(app.getPath('userData'))

  sessionManager.setExternalUrlOpener((url) => shell.openExternal(url))

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

  const samplingStreamSubscribers = new Set<number>()

  const broadcastSamplingPending = (pending: SamplingPendingRequest[]): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!samplingStreamSubscribers.has(window.webContents.id) || window.isDestroyed()) {
        continue
      }
      window.webContents.send(IPC_CHANNELS.mcpSamplingStream, pending)
    }
  }

  sessionManager.onSamplingChange(() => {
    if (samplingStreamSubscribers.size === 0) return
    broadcastSamplingPending(sessionManager.listPendingSampling())
  })

  const elicitationStreamSubscribers = new Set<number>()

  const broadcastElicitationPending = (pending: ElicitationPendingRequest[]): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!elicitationStreamSubscribers.has(window.webContents.id) || window.isDestroyed()) {
        continue
      }
      window.webContents.send(IPC_CHANNELS.mcpElicitationStream, pending)
    }
  }

  sessionManager.onElicitationChange(() => {
    if (elicitationStreamSubscribers.size === 0) return
    broadcastElicitationPending(sessionManager.listPendingElicitations())
  })

  const inflightStreamSubscribers = new Set<number>()

  const broadcastInflightOperations = (operations: InflightOperationSummary[]): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!inflightStreamSubscribers.has(window.webContents.id) || window.isDestroyed()) {
        continue
      }
      window.webContents.send(IPC_CHANNELS.mcpInflightStream, operations)
    }
  }

  sessionManager.onInflightChange(() => {
    if (inflightStreamSubscribers.size === 0) return
    broadcastInflightOperations(sessionManager.listInflightOperations())
  })

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlerNoInput(
    IPC_CHANNELS.appGetMeta,
    (): AppMeta => ({
      name: APP_NAME,
      version: APP_VERSION,
      platform: process.platform
    })
  )

  registerIpcHandlerNoInput(
    IPC_CHANNELS.appPing,
    (): PingResponse => ({
      ok: true,
      at: new Date().toISOString()
    })
  )

  registerIpcHandlerNoInput(IPC_CHANNELS.serverProfilesList, () => listServerProfiles())

  registerIpcHandler(IPC_CHANNELS.serverProfilesUpsert, upsertServerProfileSchema, (input) => {
    // Zod's `.optional()` produces `T | undefined`; IPC types use `?:` without `| undefined`.
    // Cast is safe — the schema validates the runtime shape.
    const profile = upsertServerProfile(input as UpsertServerProfileInput)
    if (input.id !== undefined) {
      void sessionManager.notifyRootsChanged(profile.id)
    }
    return profile
  })

  registerIpcHandler(IPC_CHANNELS.serverProfilesDelete, deleteServerProfileSchema, (input) =>
    deleteServerProfile(input)
  )

  registerIpcHandler(IPC_CHANNELS.mcpSessionConnect, sessionConnectSchema, (input) =>
    sessionManager.connect(input as SessionConnectInput)
  )

  registerIpcHandler(IPC_CHANNELS.mcpSessionDisconnect, sessionDisconnectSchema, (input) =>
    sessionManager.disconnect(input)
  )

  registerIpcHandler(IPC_CHANNELS.mcpSessionStatus, sessionStatusSchema, (input) =>
    sessionManager.getStatus(input.sessionId)
  )

  registerIpcHandler(IPC_CHANNELS.mcpSessionMessages, sessionMessagesSchema, (input) =>
    sessionManager.getMessages(input.sessionId, input.limit)
  )

  registerIpcHandler(
    IPC_CHANNELS.mcpSessionMessagesStream,
    sessionMessagesStreamSchema,
    (input, event) => {
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

  registerIpcHandler(IPC_CHANNELS.mcpSessionList, sessionListSchema, (input) =>
    sessionManager.listSessions(input.limit)
  )

  registerIpcHandler(IPC_CHANNELS.mcpDiscoveryListTools, discoverySessionSchema, (input) =>
    sessionManager.listTools(input.sessionId)
  )

  registerIpcHandler(IPC_CHANNELS.mcpDiscoveryListResources, discoverySessionSchema, (input) =>
    sessionManager.listResources(input.sessionId)
  )

  registerIpcHandler(IPC_CHANNELS.mcpDiscoveryListPrompts, discoverySessionSchema, (input) =>
    sessionManager.listPrompts(input.sessionId)
  )

  registerIpcHandler(IPC_CHANNELS.mcpDiscoveryCallTool, discoveryCallToolSchema, (input) =>
    sessionManager.callTool(input as DiscoveryCallToolInput)
  )

  registerIpcHandler(IPC_CHANNELS.mcpDiscoveryReadResource, discoveryReadResourceSchema, (input) =>
    sessionManager.readResource(input)
  )

  registerIpcHandler(IPC_CHANNELS.mcpDiscoveryGetPrompt, discoveryGetPromptSchema, (input) =>
    sessionManager.getPrompt(input as DiscoveryGetPromptInput)
  )

  registerIpcHandler(IPC_CHANNELS.mcpSamplingListPending, samplingListPendingSchema, () =>
    sessionManager.listPendingSampling()
  )

  registerIpcHandler(IPC_CHANNELS.mcpSamplingRespond, samplingRespondSchema, (input) =>
    // Zod's optional → `T | undefined`; IPC type uses `?:` only. Schema validates the shape.
    sessionManager.respondSampling(input as Parameters<typeof sessionManager.respondSampling>[0])
  )

  registerIpcHandler(IPC_CHANNELS.mcpSamplingReject, samplingRejectSchema, (input) =>
    sessionManager.rejectSampling(input as Parameters<typeof sessionManager.rejectSampling>[0])
  )

  registerIpcHandler(IPC_CHANNELS.mcpSamplingStream, samplingStreamSchema, (input, event) => {
    if (input.enabled) {
      samplingStreamSubscribers.add(event.sender.id)
    } else {
      samplingStreamSubscribers.delete(event.sender.id)
    }

    event.sender.once('destroyed', () => {
      samplingStreamSubscribers.delete(event.sender.id)
    })

    return { ok: true as const }
  })

  registerIpcHandler(IPC_CHANNELS.mcpElicitationListPending, elicitationListPendingSchema, () =>
    sessionManager.listPendingElicitations()
  )

  registerIpcHandler(IPC_CHANNELS.mcpElicitationRespond, elicitationRespondSchema, (input) =>
    // Zod optional → `T | undefined`; IPC type uses `?:` only. Schema validates the shape.
    sessionManager.respondElicitation(
      input as Parameters<typeof sessionManager.respondElicitation>[0]
    )
  )

  registerIpcHandler(IPC_CHANNELS.mcpElicitationStream, elicitationStreamSchema, (input, event) => {
    if (input.enabled) {
      elicitationStreamSubscribers.add(event.sender.id)
    } else {
      elicitationStreamSubscribers.delete(event.sender.id)
    }

    event.sender.once('destroyed', () => {
      elicitationStreamSubscribers.delete(event.sender.id)
    })

    return { ok: true as const }
  })

  registerIpcHandler(IPC_CHANNELS.mcpInflightList, inflightListSchema, () =>
    sessionManager.listInflightOperations()
  )

  registerIpcHandler(IPC_CHANNELS.mcpInflightCancel, inflightCancelSchema, (input) =>
    // Zod optional → `T | undefined`; IPC type uses `?:` only. Schema validates the shape.
    sessionManager.cancelInflightOperation(
      input as Parameters<typeof sessionManager.cancelInflightOperation>[0]
    )
  )

  registerIpcHandler(IPC_CHANNELS.mcpInflightStream, inflightStreamSchema, (input, event) => {
    if (input.enabled) {
      inflightStreamSubscribers.add(event.sender.id)
    } else {
      inflightStreamSubscribers.delete(event.sender.id)
    }

    event.sender.once('destroyed', () => {
      inflightStreamSubscribers.delete(event.sender.id)
    })

    return { ok: true as const }
  })

  registerIpcHandlerNoInput(IPC_CHANNELS.appCheckForUpdates, () => checkForUpdates())
  registerIpcHandlerNoInput(IPC_CHANNELS.appInstallUpdate, () => {
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
  ipcMain.removeHandler(IPC_CHANNELS.mcpSamplingListPending)
  ipcMain.removeHandler(IPC_CHANNELS.mcpSamplingRespond)
  ipcMain.removeHandler(IPC_CHANNELS.mcpSamplingReject)
  ipcMain.removeHandler(IPC_CHANNELS.mcpSamplingStream)
  ipcMain.removeHandler(IPC_CHANNELS.mcpElicitationListPending)
  ipcMain.removeHandler(IPC_CHANNELS.mcpElicitationRespond)
  ipcMain.removeHandler(IPC_CHANNELS.mcpElicitationStream)
  ipcMain.removeHandler(IPC_CHANNELS.mcpInflightList)
  ipcMain.removeHandler(IPC_CHANNELS.mcpInflightCancel)
  ipcMain.removeHandler(IPC_CHANNELS.mcpInflightStream)
  ipcMain.removeHandler(IPC_CHANNELS.appCheckForUpdates)
  ipcMain.removeHandler(IPC_CHANNELS.appInstallUpdate)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
