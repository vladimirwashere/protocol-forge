import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { ListRootsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { ProfileRoot } from '../../../shared/ipc'

export type RootsProvider = () => ProfileRoot[]

export function registerRootsHandler(client: Client, getRoots: RootsProvider): void {
  client.setRequestHandler(ListRootsRequestSchema, () => ({
    roots: getRoots().map((root) => (root.name !== undefined ? root : { uri: root.uri }))
  }))
}

export async function notifyRootsChanged(client: Client): Promise<void> {
  await client.sendRootsListChanged()
}
