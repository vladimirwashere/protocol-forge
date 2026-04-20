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

export const parseStdioArgsRaw = (raw: string): string[] => {
  return raw
    .split(/\s+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}
