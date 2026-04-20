import { describe, expect, it } from 'vitest'
import { parseShellPath, SHELL_ENV_DELIMITER as DELIM } from '../src/main/fix-env-path'

function wrap(body: string): string {
  return `some pre-shell noise\n${DELIM}\n${body}\n${DELIM}\n`
}

describe('parseShellPath', () => {
  it('extracts PATH from delimited shell env output', () => {
    const output = wrap('HOME=/Users/vlad\nPATH=/opt/homebrew/bin:/usr/bin:/bin\nUSER=vlad')
    expect(parseShellPath(output)).toBe('/opt/homebrew/bin:/usr/bin:/bin')
  })

  it('returns null when delimiters are missing', () => {
    expect(parseShellPath('PATH=/usr/bin')).toBeNull()
  })

  it('returns null when only a single delimiter is emitted', () => {
    expect(parseShellPath(`${DELIM}\nPATH=/usr/bin\n`)).toBeNull()
  })

  it('returns null when PATH is not set in the captured env', () => {
    expect(parseShellPath(wrap('HOME=/Users/vlad\nUSER=vlad'))).toBeNull()
  })

  it('returns null for an empty PATH value', () => {
    expect(parseShellPath(wrap('PATH=\nHOME=/Users/vlad'))).toBeNull()
  })

  it('ignores env vars whose name merely contains PATH', () => {
    const output = wrap('MANPATH=/usr/share/man\nFAKEPATH=/nope\nPATH=/real/path')
    expect(parseShellPath(output)).toBe('/real/path')
  })

  it('preserves values containing = characters', () => {
    const output = wrap('PATH=/a/b:/c=d/e\nHOME=/Users/vlad')
    expect(parseShellPath(output)).toBe('/a/b:/c=d/e')
  })
})
