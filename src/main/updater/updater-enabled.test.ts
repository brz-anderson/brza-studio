import { beforeEach, describe, expect, it, vi } from 'vitest'

const adHoc = vi.hoisted(() => ({ value: false }))
vi.mock('./ad-hoc-signed-build', () => ({ isAdHocSignedBuild: () => adHoc.value }))

const electron = vi.hoisted(() => ({
  app: { isPackaged: true, getVersion: (): string => '1.4.242' }
}))

vi.mock('electron', () => electron)

import { isUpdaterEnabled } from './updater-enabled'

describe('isUpdaterEnabled', () => {
  beforeEach(() => {
    electron.app.isPackaged = true
    adHoc.value = false
  })

  it('keeps the updater on for a packaged release version', () => {
    electron.app.getVersion = () => '1.4.242'
    expect(isUpdaterEnabled()).toBe(true)
  })

  it('turns it off for a version stamped by the local build', () => {
    electron.app.getVersion = () => '1.4.242-local.1.abc'
    expect(isUpdaterEnabled()).toBe(false)
  })

  it('turns it off for a bundle signed ad hoc, whatever its version', () => {
    electron.app.getVersion = () => '1.4.246-alpha.1'
    adHoc.value = true
    expect(isUpdaterEnabled()).toBe(false)
  })

  it('keeps it on for a packaged build signed with an identity', () => {
    electron.app.getVersion = () => '1.4.246-alpha.1'
    expect(isUpdaterEnabled()).toBe(true)
  })
})
