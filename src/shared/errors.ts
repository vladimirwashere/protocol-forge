export type AppErrorCode =
  | 'INVALID_INPUT'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_ALREADY_ACTIVE'
  | 'SESSION_CONNECT_FAILED'
  | 'SESSION_DISCONNECT_FAILED'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly details?: Record<string, unknown>

  constructor(code: AppErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'AppError'
    this.code = code
    if (details !== undefined) {
      this.details = details
    }
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return 'Unknown error'
}
