import { isAbsolute } from 'node:path'
import {
  StdioClientTransport,
  getDefaultEnvironment
} from '@modelcontextprotocol/sdk/client/stdio.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { z } from 'zod'
import { AppError } from '../../../shared/errors'
import type { StdioConnectInput } from '../../../shared/ipc'
import { TracingTransport } from './tracing-transport'
import type { MessageTraceHandler } from './tracing-transport'

export type { MessageTraceHandler, TraceDirection } from './tracing-transport'

const envKeySchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Invalid env var name')

const envValueSchema = z.string().max(8192, 'Env var value is too long')

const stdioConnectSchema = z.object({
  command: z.string().trim().min(1, 'Command is required').max(4096),
  args: z.array(z.string().max(4096)).default([]),
  cwd: z.string().trim().min(1, 'Working directory is required').max(4096).optional(),
  env: z.record(envKeySchema, envValueSchema).default({})
})

export type SafeStdioConfig = {
  command: string
  args: string[]
  cwd?: string
  env: Record<string, string>
}

export function normalizeAndValidateStdioInput(input: StdioConnectInput): SafeStdioConfig {
  const parsed = stdioConnectSchema.safeParse(input)

  if (!parsed.success) {
    throw new AppError(
      'INVALID_INPUT',
      parsed.error.issues.map((issue) => issue.message).join(', ')
    )
  }

  const command = parsed.data.command.trim()

  if (command.includes('\u0000') || command.includes('\n') || command.includes('\r')) {
    throw new AppError('INVALID_INPUT', 'Command contains invalid control characters')
  }

  if ((command.includes('/') || command.includes('\\')) && !isAbsolute(command)) {
    throw new AppError('INVALID_INPUT', 'Command path must be absolute when a path is provided')
  }

  const args = parsed.data.args.map((arg) => arg.trim()).filter((arg) => arg.length > 0)
  const cwd = parsed.data.cwd?.trim()

  const normalized: SafeStdioConfig = {
    command,
    args,
    env: parsed.data.env
  }

  if (cwd !== undefined) {
    normalized.cwd = cwd
  }

  return normalized
}

export function buildStdioServerParams(validated: SafeStdioConfig): {
  command: string
  args: string[]
  env: Record<string, string>
  cwd?: string
} {
  const serverParams: {
    command: string
    args: string[]
    env: Record<string, string>
    cwd?: string
  } = {
    command: validated.command,
    args: validated.args,
    env: {
      ...getDefaultEnvironment(),
      ...validated.env
    }
  }

  if (validated.cwd !== undefined) {
    serverParams.cwd = validated.cwd
  }

  return serverParams
}

export function createTracedStdioTransport(
  input: StdioConnectInput,
  onTrace: MessageTraceHandler
): Transport {
  const validated = normalizeAndValidateStdioInput(input)
  const serverParams = buildStdioServerParams(validated)

  const base = new StdioClientTransport(serverParams)

  return new TracingTransport(base, onTrace)
}
