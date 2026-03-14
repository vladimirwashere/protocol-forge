export const parseSseHeadersRaw = (raw: string): Record<string, string> => {
  const headers: Record<string, string> = {}

  for (const [index, line] of raw.split(/\r?\n/).entries()) {
    const trimmed = line.trim()
    if (trimmed.length === 0) {
      continue
    }

    const separator = trimmed.indexOf(':')
    if (separator <= 0) {
      throw new Error(`Invalid SSE header on line ${index + 1}. Use "Header-Name: value".`)
    }

    const key = trimmed.slice(0, separator).trim()
    const value = trimmed.slice(separator + 1).trim()

    if (key.length === 0) {
      throw new Error(`Invalid SSE header key on line ${index + 1}`)
    }

    headers[key] = value
  }

  return headers
}

const stripLabeledPrefix = (raw: string, label: string): string => {
  const trimmed = raw.trim()
  const prefix = `${label.toLowerCase()}:`

  if (trimmed.toLowerCase().startsWith(prefix)) {
    return trimmed.slice(prefix.length).trim()
  }

  return trimmed
}

export const normalizeCommandInput = (raw: string): string => {
  return stripLabeledPrefix(raw, 'command')
}

export const normalizeSseUrlInput = (raw: string): string => {
  return stripLabeledPrefix(raw, 'url')
}

export const parseStdioArgsRaw = (raw: string): string[] => {
  const withoutLabel = stripLabeledPrefix(raw, 'args')

  return withoutLabel
    .split(/\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

export const normalizeLegacyArgs = (args: string[]): string[] => {
  const first = args[0]

  if (first === undefined) {
    return args
  }

  const rest = args.slice(1)
  const normalizedFirst = first.trim().toLowerCase()

  if (normalizedFirst === 'args:' || normalizedFirst === 'args') {
    return rest
  }

  return args
}
