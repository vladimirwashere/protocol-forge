import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { z } from 'zod'
import { AppError } from '../../shared/errors'

export function registerIpcHandler<S extends z.ZodTypeAny, Out>(
  channel: string,
  schema: S,
  handler: (input: z.infer<S>, event: IpcMainInvokeEvent) => Out | Promise<Out>
): void {
  ipcMain.handle(channel, (event, raw) => {
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      throw new AppError(
        'INVALID_INPUT',
        parsed.error.issues.map((issue) => issue.message).join(', '),
        { channel }
      )
    }
    return handler(parsed.data, event)
  })
}

export function registerIpcHandlerNoInput<Out>(
  channel: string,
  handler: (event: IpcMainInvokeEvent) => Out | Promise<Out>
): void {
  ipcMain.handle(channel, (event) => handler(event))
}
