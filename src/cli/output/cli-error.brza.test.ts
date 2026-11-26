import { describe, expect, it } from 'vitest'
import { formatCliError } from './cli-error'
import { RuntimeClientError, RuntimeRpcFailureError } from '../runtime/connection/types'

describe('runtime unavailable messages', () => {
  it('names BrzA Studio when the app is not running', () => {
    const text = formatCliError(new RuntimeClientError('runtime_unavailable', 'Cannot connect.'))
    expect(text).toContain('BrzA Studio is not running.')
    expect(text).not.toContain('Orca is')
  })

  it('names BrzA Studio when the app is running but not ready', () => {
    const error = new RuntimeRpcFailureError({
      id: 'req',
      ok: false,
      error: { code: 'runtime_unavailable', message: 'Not ready.' },
      _meta: { runtimeId: 'rt' }
    })
    const text = formatCliError(error)
    expect(text).toContain('BrzA Studio is running but not ready')
    expect(text).not.toContain('Orca is')
  })
})
