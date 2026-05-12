import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type {
  DiscoveryCallToolInput,
  DiscoveryGetPromptInput,
  DiscoveryListPromptsResponse,
  DiscoveryListResourcesResponse,
  DiscoveryListToolsResponse,
  DiscoveryOperationResult,
  DiscoveryReadResourceInput
} from '../../../shared/ipc'

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
  input: DiscoveryCallToolInput
): Promise<DiscoveryOperationResult> {
  const { value, ms } = await runTimedOperation(() =>
    client.callTool({
      name: input.name,
      arguments: input.arguments
    })
  )

  return { result: value, latencyMs: ms }
}

export async function readResource(
  client: Client,
  input: DiscoveryReadResourceInput
): Promise<DiscoveryOperationResult> {
  const { value, ms } = await runTimedOperation(() => client.readResource({ uri: input.uri }))
  return { result: value, latencyMs: ms }
}

export async function getPrompt(
  client: Client,
  input: DiscoveryGetPromptInput
): Promise<DiscoveryOperationResult> {
  const { value, ms } = await runTimedOperation(() =>
    client.getPrompt({
      name: input.name,
      arguments: input.arguments
    })
  )
  return { result: value, latencyMs: ms }
}
