import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type {
  DiscoveryCallToolInput,
  DiscoveryCompleteInput,
  DiscoveryCompleteResult,
  DiscoveryGetPromptInput,
  DiscoveryListPromptsResponse,
  DiscoveryListResourcesResponse,
  DiscoveryListResourceTemplatesResponse,
  DiscoveryListToolsResponse,
  DiscoveryOperationResult,
  DiscoveryReadResourceInput,
  InflightOperationProgress,
  ToolAnnotations,
  ToolIcon
} from '../../../shared/ipc'

export type DiscoveryProgressCallback = (progress: InflightOperationProgress) => void

export type DiscoveryCallOptions = {
  signal?: AbortSignal
  onProgress?: DiscoveryProgressCallback
}

function buildRequestOptions(
  options: DiscoveryCallOptions | undefined
): RequestOptions | undefined {
  if (!options) return undefined
  const requestOptions: RequestOptions = {}
  if (options.signal) requestOptions.signal = options.signal
  if (options.onProgress) {
    requestOptions.onprogress = (progress) => {
      const projected: InflightOperationProgress = {
        progress: progress.progress,
        at: new Date().toISOString()
      }
      if (progress.total !== undefined) projected.total = progress.total
      if (progress.message !== undefined) projected.message = progress.message
      options.onProgress!(projected)
    }
  }
  return requestOptions
}

async function runTimedOperation<T>(
  operation: () => Promise<T>
): Promise<{ value: T; ms: number }> {
  const startedAt = Date.now()
  const value = await operation()
  return { value, ms: Math.max(0, Date.now() - startedAt) }
}

function projectToolAnnotations(raw: unknown): ToolAnnotations | undefined {
  if (raw === null || typeof raw !== 'object') return undefined
  const source = raw as Record<string, unknown>
  const projected: ToolAnnotations = {}
  if (typeof source.title === 'string') projected.title = source.title
  if (typeof source.readOnlyHint === 'boolean') projected.readOnlyHint = source.readOnlyHint
  if (typeof source.destructiveHint === 'boolean')
    projected.destructiveHint = source.destructiveHint
  if (typeof source.idempotentHint === 'boolean') projected.idempotentHint = source.idempotentHint
  if (typeof source.openWorldHint === 'boolean') projected.openWorldHint = source.openWorldHint
  return Object.keys(projected).length > 0 ? projected : undefined
}

function projectToolIcons(raw: unknown): ToolIcon[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const icons: ToolIcon[] = []
  for (const entry of raw) {
    if (entry === null || typeof entry !== 'object') continue
    const source = entry as Record<string, unknown>
    if (typeof source.src !== 'string') continue
    const icon: ToolIcon = { src: source.src }
    if (typeof source.mimeType === 'string') icon.mimeType = source.mimeType
    if (Array.isArray(source.sizes)) {
      const sizes = source.sizes.filter((size): size is string => typeof size === 'string')
      if (sizes.length > 0) icon.sizes = sizes
    }
    if (source.theme === 'light' || source.theme === 'dark') icon.theme = source.theme
    icons.push(icon)
  }
  return icons.length > 0 ? icons : undefined
}

export async function listTools(client: Client): Promise<DiscoveryListToolsResponse> {
  const listed = await client.listTools()

  return {
    tools: listed.tools.map((tool) => {
      const mapped: DiscoveryListToolsResponse['tools'][number] = {
        name: tool.name,
        inputSchema: tool.inputSchema
      }

      if (typeof tool.title === 'string') mapped.title = tool.title
      if (tool.description !== undefined) mapped.description = tool.description
      if (tool.outputSchema !== undefined) mapped.outputSchema = tool.outputSchema

      const annotations = projectToolAnnotations(tool.annotations)
      if (annotations) mapped.annotations = annotations

      const icons = projectToolIcons((tool as { icons?: unknown }).icons)
      if (icons) mapped.icons = icons

      return mapped
    })
  }
}

export async function listResources(client: Client): Promise<DiscoveryListResourcesResponse> {
  const listed = await client.listResources()

  return {
    resources: listed.resources.map((resource) => {
      const mapped: DiscoveryListResourcesResponse['resources'][number] = {
        uri: resource.uri,
        name: resource.name
      }

      if (resource.description !== undefined) mapped.description = resource.description
      if (resource.mimeType !== undefined) mapped.mimeType = resource.mimeType

      return mapped
    })
  }
}

export async function listResourceTemplates(
  client: Client
): Promise<DiscoveryListResourceTemplatesResponse> {
  const listed = await client.listResourceTemplates()

  const projected: DiscoveryListResourceTemplatesResponse = { resourceTemplates: [] }
  if (!Array.isArray(listed.resourceTemplates)) return projected

  for (const entry of listed.resourceTemplates) {
    if (entry === null || typeof entry !== 'object') continue
    const source = entry as Record<string, unknown>
    if (typeof source.uriTemplate !== 'string' || typeof source.name !== 'string') continue
    const mapped: DiscoveryListResourceTemplatesResponse['resourceTemplates'][number] = {
      uriTemplate: source.uriTemplate,
      name: source.name
    }
    if (typeof source.title === 'string') mapped.title = source.title
    if (typeof source.description === 'string') mapped.description = source.description
    if (typeof source.mimeType === 'string') mapped.mimeType = source.mimeType
    const icons = projectToolIcons(source.icons)
    if (icons) mapped.icons = icons
    projected.resourceTemplates.push(mapped)
  }

  return projected
}

export async function listPrompts(client: Client): Promise<DiscoveryListPromptsResponse> {
  const listed = await client.listPrompts()

  return {
    prompts: listed.prompts.map((prompt) => {
      const mapped: DiscoveryListPromptsResponse['prompts'][number] = {
        name: prompt.name
      }

      if (prompt.description !== undefined) mapped.description = prompt.description

      if (prompt.arguments !== undefined) {
        mapped.arguments = prompt.arguments.map((argument) => {
          const mappedArgument: NonNullable<
            DiscoveryListPromptsResponse['prompts'][number]['arguments']
          >[number] = {
            name: argument.name
          }

          if (argument.description !== undefined) mappedArgument.description = argument.description
          if (argument.required !== undefined) mappedArgument.required = argument.required

          return mappedArgument
        })
      }

      return mapped
    })
  }
}

export async function callTool(
  client: Client,
  input: DiscoveryCallToolInput,
  options?: DiscoveryCallOptions
): Promise<DiscoveryOperationResult> {
  const requestOptions = buildRequestOptions(options)
  const { value, ms } = await runTimedOperation(() =>
    requestOptions
      ? client.callTool({ name: input.name, arguments: input.arguments }, undefined, requestOptions)
      : client.callTool({ name: input.name, arguments: input.arguments })
  )

  return { result: value, latencyMs: ms }
}

export async function readResource(
  client: Client,
  input: DiscoveryReadResourceInput,
  options?: DiscoveryCallOptions
): Promise<DiscoveryOperationResult> {
  const requestOptions = buildRequestOptions(options)
  const { value, ms } = await runTimedOperation(() =>
    requestOptions
      ? client.readResource({ uri: input.uri }, requestOptions)
      : client.readResource({ uri: input.uri })
  )
  return { result: value, latencyMs: ms }
}

export async function complete(
  client: Client,
  input: DiscoveryCompleteInput
): Promise<DiscoveryCompleteResult> {
  const params: Parameters<Client['complete']>[0] = {
    ref: input.ref,
    argument: input.argument
  }
  if (input.context !== undefined) {
    const context: { arguments?: Record<string, string> } = {}
    if (input.context.arguments !== undefined) context.arguments = input.context.arguments
    params.context = context
  }

  const response = await client.complete(params)
  const { values, total, hasMore } = response.completion

  const projected: DiscoveryCompleteResult = { values }
  if (typeof total === 'number') projected.total = total
  if (typeof hasMore === 'boolean') projected.hasMore = hasMore
  return projected
}

export async function getPrompt(
  client: Client,
  input: DiscoveryGetPromptInput,
  options?: DiscoveryCallOptions
): Promise<DiscoveryOperationResult> {
  const requestOptions = buildRequestOptions(options)
  const { value, ms } = await runTimedOperation(() =>
    requestOptions
      ? client.getPrompt({ name: input.name, arguments: input.arguments }, requestOptions)
      : client.getPrompt({ name: input.name, arguments: input.arguments })
  )
  return { result: value, latencyMs: ms }
}
