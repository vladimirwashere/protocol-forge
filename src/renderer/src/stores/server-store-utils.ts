export const parseHttpHeadersRaw = (raw: string): Record<string, string> => {
  const headers: Record<string, string> = {}

  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      continue
    }

    const separator = trimmed.indexOf(':')
    if (separator <= 0) {
      throw new Error(`Invalid header on line ${index + 1}. Use "Header-Name: value".`)
    }

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()

    if (key.length === 0) {
      throw new Error(`Invalid header key on line ${index + 1}`)
    }

    headers[key] = value
  }

  return headers
}

export const parseStdioArgsRaw = (raw: string): string[] => {
  return raw
    .split(/\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

export type ParsedRoot = { uri: string; name?: string }

const isValidFileUri = (value: string): boolean => {
  if (!value.startsWith('file://')) return false
  try {
    return new URL(value).protocol === 'file:'
  } catch {
    return false
  }
}

export const parseRootsRaw = (raw: string): ParsedRoot[] => {
  const roots: ParsedRoot[] = []

  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim()
    if (trimmed.length === 0) continue

    const separator = trimmed.indexOf('|')
    let uri: string
    let name: string | undefined

    if (separator > 0) {
      name = trimmed.slice(0, separator).trim()
      uri = trimmed.slice(separator + 1).trim()
    } else {
      uri = trimmed
    }

    if (!isValidFileUri(uri)) {
      throw new Error(
        `Invalid root on line ${index + 1}. Use "file:///absolute/path" (optionally "name|file:///path").`
      )
    }

    const root: ParsedRoot = { uri }
    if (name !== undefined && name.length > 0) root.name = name
    roots.push(root)
  }

  return roots
}

export const stringifyRoots = (roots: ParsedRoot[]): string =>
  roots.map((root) => (root.name !== undefined ? `${root.name}|${root.uri}` : root.uri)).join('\n')
