import { beforeEach, describe, expect, it, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  app: { isPackaged: true, getVersion: (): string => '1.4.242' }
}))

vi.mock('electron', () => electron)

import { isUpdaterEnabled } from './updater-enabled'

describe('isUpdaterEnabled', () => {
  beforeEach(() => {
    electron.app.isPackaged = true
  })

  it('keeps the updater on for a packaged release version', () => {
    electron.app.getVersion = () => '1.4.242'
    expect(isUpdaterEnabled()).toBe(true)
  })

  it('turns it off for a version stamped by the local build', () => {
    electron.app.getVersion = () => '1.4.242-local.1.abc'
    expect(isUpdaterEnabled()).toBe(false)
  })
})
