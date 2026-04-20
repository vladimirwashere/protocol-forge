import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { z } from 'zod'
import { AppError } from '../../../shared/errors'
import type { StreamableHttpConnectInput } from '../../../shared/ipc'
import { TracingTransport } from './tracing-transport'
import type { MessageTraceHandler } from './tracing-transport'

const headerNameSchema = z
  .string()
  .trim()
  .min(1, 'Header name is required')
  .max(256, 'Header name is too long')

const headerValueSchema = z.string().trim().max(4096, 'Header value is too long')

const streamableHttpConnectSchema = z.object({
  url: z.string().trim().url('Streamable HTTP URL must be a valid URL').max(4096),
  headers: z.record(headerNameSchema, headerValueSchema).default({})
})

export type SafeStreamableHttpConfig = {
  url: string
  headers: Record<string, string>
}

export function normalizeAndValidateStreamableHttpInput(
  input: StreamableHttpConnectInput
): SafeStreamableHttpConfig {
  const parsed = streamableHttpConnectSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(
      'INVALID_INPUT',
      parsed.error.issues.map((issue) => issue.message).join(', ')
    )
  }

  const url = new URL(parsed.data.url)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new AppError('INVALID_INPUT', 'Streamable HTTP URL must use http or https')
  }

  return {
    url: url.toString(),
    headers: parsed.data.headers
  }
}

export function createTracedStreamableHttpTransport(
  input: StreamableHttpConnectInput,
  onTrace: MessageTraceHandler
): Transport {
  const validated = normalizeAndValidateStreamableHttpInput(input)

  const base = new StreamableHTTPClientTransport(new URL(validated.url), {
    requestInit: {
      headers: validated.headers
    }
  }) as unknown as Transport

  return new TracingTransport(base, onTrace)
}
