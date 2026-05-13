export type AppErrorCode =
  | 'INVALID_INPUT'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_NOT_READY'
  | 'SESSION_ALREADY_ACTIVE'
  | 'SESSION_CONNECT_FAILED'
  | 'SESSION_DISCONNECT_FAILED'
  | 'SAMPLING_REQUEST_NOT_FOUND'
  | 'ELICITATION_REQUEST_NOT_FOUND'
  | 'ELICITATION_URL_NOT_AVAILABLE'
  | 'INFLIGHT_OPERATION_NOT_FOUND'
  | 'COMPLETIONS_NOT_SUPPORTED'
  | 'RESOURCE_SUBSCRIBE_NOT_SUPPORTED'
  | 'LOGGING_NOT_SUPPORTED'

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
