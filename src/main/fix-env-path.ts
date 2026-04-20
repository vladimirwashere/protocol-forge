import { execFileSync } from 'node:child_process'

const DELIMITER = '--protocol-forge-env-delimiter--'

export const SHELL_ENV_DELIMITER = DELIMITER

export function parseShellPath(output: string): string | null {
  const start = output.indexOf(DELIMITER)
  const end = output.lastIndexOf(DELIMITER)

  if (start === -1 || end === -1 || start === end) {
    return null
  }

  const body = output.slice(start + DELIMITER.length, end)

  for (const line of body.split('\n')) {
    const eq = line.indexOf('=')
    if (eq === -1) continue
    if (line.slice(0, eq) === 'PATH') {
      return line.slice(eq + 1).trim() || null
    }
  }

  return null
}

/**
 * Electron apps launched from Finder/Dock on macOS (and some Linux desktop
 * environments) inherit the minimal OS default PATH, which omits Homebrew,
 * nvm, pyenv, etc. That makes stdio MCP servers invoked via `npx`, `python`,
 * `uvx`, and similar fail with ENOENT. Spawn the user's login shell once at
 * startup to import their real PATH so child processes can resolve binaries.
 *
 * Windows inherits PATH correctly from the GUI launcher, so this is a no-op.
 */
export function fixEnvPath(): void {
  if (process.platform === 'win32') return

  const shell = process.env.SHELL
  if (!shell) return

  try {
    const output = execFileSync(shell, ['-ilc', `echo "${DELIMITER}"; env; echo "${DELIMITER}"`], {
      encoding: 'utf8',
      timeout: 3000,
      stdio: ['ignore', 'pipe', 'ignore']
    })

    const shellPath = parseShellPath(output)
    if (shellPath) {
      process.env.PATH = shellPath
    }
  } catch {
    // Shell invocation failed (exotic shell, broken rc file, timeout). Leave
    // PATH untouched — users can still set absolute command paths or override
    // PATH in the profile env field.
  }
}
