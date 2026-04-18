const { execFileSync } = require('child_process')
const path = require('path')

/**
 * Applies a deep ad-hoc signature to the packaged .app on macOS.
 *
 * electron-builder ad-hoc-signs the outer bundle but leaves Electron's
 * framework with its original signature. macOS Tahoe's hardened runtime
 * then rejects the mix at launch with "mapping process and mapped file
 * (non-platform) have different Team IDs". Re-signing with --deep forces
 * a consistent ad-hoc signature across every nested binary.
 *
 * No-op on non-mac platforms and when a real signing identity is in use
 * (env var CSC_LINK present — a cert build will already be deeply signed).
 */
exports.default = async function afterSign(context) {
  if (context.electronPlatformName !== 'darwin') return
  if (process.env.CSC_LINK) return

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  )

  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit'
  })
}
