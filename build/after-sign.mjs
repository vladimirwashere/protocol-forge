import { execFileSync } from 'node:child_process'
import path from 'node:path'

/**
 * Deep ad-hoc-signs the packaged .app on macOS. electron-builder signs the
 * outer bundle but leaves Electron's framework with its original signature,
 * which macOS Tahoe rejects at launch ("different Team IDs"). No-op on
 * non-mac and when a real signing identity (CSC_LINK) is in use.
 */
export default async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  if (process.env.CSC_LINK) return

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)

  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit'
  })
}
