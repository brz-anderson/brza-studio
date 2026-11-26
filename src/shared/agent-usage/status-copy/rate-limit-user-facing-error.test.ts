import { describe, expect, it } from 'vitest'
import { formatRateLimitUserFacingError } from './rate-limit-user-facing-error'

const t = (key: string) => `t:${key}`

describe('formatRateLimitUserFacingError', () => {
  it.each(['Orca', 'BrzA Studio'])('translates the Grok sign-in error emitted with %s', (brand) => {
    expect(
      formatRateLimitUserFacingError(
        `Grok sign-in expired — run grok on the computer running ${brand}; sign in if prompted. No chat message is needed.`,
        t
      )
    ).toBe('t:auto.lib.rateLimits.errors.grokSignInExpired')
  })

  it('returns unknown messages unchanged', () => {
    expect(formatRateLimitUserFacingError('Unknown BrzA Studio failure', t)).toBe(
      'Unknown BrzA Studio failure'
    )
  })
})
