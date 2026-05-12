import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js'
import type {
  DiscoveryCallToolInput,
  DiscoveryGetPromptInput,
  DiscoveryListPromptsResponse,
  DiscoveryListResourcesResponse,
  DiscoveryListToolsResponse,
  DiscoveryOperationResult,
  DiscoveryReadResourceInput,
  InflightOperationProgress
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

export async function listTools(client: Client): Promise<DiscoveryListToolsResponse> {
  const listed = await client.listTools()

  return {
    tools: listed.tools.map((tool) => {
      const mapped: DiscoveryListToolsResponse['tools'][number] = {
        name: tool.name,
        inputSchema: tool.inputSchema
      }

      if (tool.description !== undefined) mapped.description = tool.description
      if (tool.outputSchema !== undefined) mapped.outputSchema = tool.outputSchema
      if (tool.annotations !== undefined) {
        mapped.annotations = tool.annotations as Record<string, unknown>
      }

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
