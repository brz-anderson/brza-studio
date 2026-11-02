import { describe, expect, it } from 'vitest'
import { getDevInstanceIdentity, shouldApplyPreReadyAppName } from '../dev-instance-identity'

// Coexistence with upstream Orca: nothing here may fall back to Orca's name, Keychain item or AppUserModelID.
describe('dev-instance-identity of BrzA Studio beside upstream Orca', () => {
  it('keeps the packaged identity apart from Orca', () => {
    expect(getDevInstanceIdentity(false, {})).toMatchObject({
      name: 'BrzA Studio',
      appName: 'BrzA Studio',
      isDev: false,
      devLabel: null,
      dockBadgeLabel: null,
      appUserModelId: 'com.brzanderson.brzastudio'
    })
  })

  it('names dev instances after BrzA Studio, never Orca', () => {
    const a = getDevInstanceIdentity(true, { ORCA_DEV_BRANCH: 'feature/a' })
    const b = getDevInstanceIdentity(true, { ORCA_DEV_BRANCH: 'feature/b' })

    expect(a.name).not.toBe(b.name)
    expect(a.appName).toBe('BrzA Studio Dev')
    expect(b.appName).toBe('BrzA Studio Dev')
    expect(a.appName).not.toBe('BrzA Studio')
  })

  it("renames a packaged build before ready so it never shares upstream Orca's Keychain item", () => {
    expect(shouldApplyPreReadyAppName(getDevInstanceIdentity(false, {}))).toBe(true)
    expect(getDevInstanceIdentity(false, {}).appName).toBe('BrzA Studio')
  })

  it('applies the dev name before ready so safeStorage sees it', () => {
    expect(shouldApplyPreReadyAppName(getDevInstanceIdentity(true, {}))).toBe(true)
  })

  it('prefixes the dev window name and AppUserModelID with the BrzA Studio ones', () => {
    const identity = getDevInstanceIdentity(true, {
      ORCA_DEV_REPO_ROOT: '/repo/worktrees/dev-indicator',
      ORCA_DEV_WORKTREE_NAME: 'dev-indicator',
      ORCA_DEV_BRANCH: 'nwparker/dev-indicator'
    })

    expect(identity.name).toBe('BrzA Studio: nwparker/dev-indicator')
    expect(identity.appUserModelId).toMatch(/^com\.brzanderson\.brzastudio\.dev\.[a-f0-9]{10}$/)
  })
})
