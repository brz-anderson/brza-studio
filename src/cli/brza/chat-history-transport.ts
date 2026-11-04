import { RuntimeClientError, RuntimeRpcFailureError } from '../runtime-client'

export function isChatHistoryTransportError(error: unknown): error is RuntimeClientError {
  return (
    error instanceof RuntimeClientError &&
    !(error instanceof RuntimeRpcFailureError) &&
    (error.code === 'runtime_timeout' ||
      error.code === 'runtime_unavailable' ||
      error.code === 'runtime_access_denied' ||
      error.code === 'remote_runtime_unavailable')
  )
}
