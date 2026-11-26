import { describe, expect, it } from 'vitest'
import type { OrcaProfileCloudSummary } from '../../../../shared/orca-profiles/orca-profiles'
import { appRailAccount } from './AppRailAccountMenu'

const CLOUD: OrcaProfileCloudSummary = {
  cloudProfileId: 'c1',
  userId: 'u1',
  email: 'alex@example.com',
  displayName: 'Alex Chen',
  linkedAt: 1
}

describe('appRailAccount', () => {
  it('prefers the display name, then the email, then the fallback', () => {
    expect(appRailAccount(CLOUD, 'BrzA Studio account')).toEqual({
      name: 'Alex Chen',
      email: 'alex@example.com',
      initial: 'A'
    })
    expect(appRailAccount({ ...CLOUD, displayName: '  ' }, 'BrzA Studio account').name).toBe(
      'alex@example.com'
    )
    expect(appRailAccount(undefined, 'BrzA Studio account')).toEqual({
      name: 'BrzA Studio account',
      email: undefined,
      initial: 'B'
    })
  })
})
