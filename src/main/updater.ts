import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC_CHANNELS, type UpdateStatus } from '../shared/ipc'

let currentStatus: UpdateStatus = { state: 'idle' }
let wired = false

function broadcast(status: UpdateStatus): void {
  currentStatus = status
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue
    }
    window.webContents.send(IPC_CHANNELS.appUpdateStatusStream, status)
  }
}

export function getCurrentUpdateStatus(): UpdateStatus {
  return currentStatus
}

export function initAutoUpdater(): void {
  if (!app.isPackaged) {
    return
  }
  if (wired) {
    return
  }
  wired = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    broadcast({ state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    broadcast({ state: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    broadcast({ state: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    broadcast({ state: 'downloading', percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    broadcast({ state: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (error) => {
    broadcast({
      state: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
  })

  void autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.warn('[protocol-forge] update check failed at startup:', error)
  })
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (error) {
    broadcast({
      state: 'error',
      message: error instanceof Error ? error.message : String(error)
    })
  }
}

export function quitAndInstall(): void {
  if (!app.isPackaged) {
    return
  }
  autoUpdater.quitAndInstall()
}
