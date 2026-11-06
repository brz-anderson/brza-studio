import { beforeEach, describe, expect, it, vi } from 'vitest'

const supports = vi.hoisted(() =>
  vi.fn<(environmentId: string, capability: string) => Promise<boolean>>()
)
vi.mock('../runtime-rpc-client', () => ({ runtimeEnvironmentSupportsCapability: supports }))

import {
  assertServerSupportsRewind,
  REWIND_NEEDS_NEWER_SERVER_MESSAGE
} from './brza-structured-agent-session-messages'

describe('assertServerSupportsRewind', () => {
  beforeEach(() => supports.mockReset())

  it('refuses a rewind on a server that lacks the capability, in the BrzA Studio wording', async () => {
    supports.mockResolvedValue(false)
    await expect(
      assertServerSupportsRewind('agentSession.rewind', {
        kind: 'environment',
        environmentId: 'env-1'
      })
    ).rejects.toThrow(
      'Rewinding requires a newer BrzA Studio server. Update the server and try again.'
    )
    expect(REWIND_NEEDS_NEWER_SERVER_MESSAGE).not.toContain('Orca')
  })

  it('lets a supporting server, another method and a local target through', async () => {
    supports.mockResolvedValue(true)
    await expect(
      assertServerSupportsRewind('agentSession.rewind', {
        kind: 'environment',
        environmentId: 'env-1'
      })
    ).resolves.toBeUndefined()
    await expect(
      assertServerSupportsRewind('agentSession.send', {
        kind: 'environment',
        environmentId: 'env-1'
      })
    ).resolves.toBeUndefined()
    await expect(
      assertServerSupportsRewind('agentSession.rewind', { kind: 'local' })
    ).resolves.toBeUndefined()
    expect(supports).toHaveBeenCalledTimes(1)
  })
})
