import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const hasSwitch = vi.fn((_name: string) => false)

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/app-data'),
    setPath: vi.fn(),
    commandLine: { hasSwitch: (name: string) => hasSwitch(name) }
  }
}))

vi.mock('./windows-app-data-path', () => ({ ensureWindowsAppDataPath: vi.fn() }))

describe('configureEarlyUserDataPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("pins packaged runs to brza-studio, apart from upstream Orca's orca folder", async () => {
    const { app } = await import('electron')
    const { configureEarlyUserDataPath } = await import('./configure-process')

    configureEarlyUserDataPath(true)

    expect(app.setPath).toHaveBeenCalledWith('userData', join('/tmp/app-data', 'brza-studio'))
  })

  it('keeps an explicit --user-data-dir and leaves dev runs to the dev profile', async () => {
    const { app } = await import('electron')
    const { configureEarlyUserDataPath } = await import('./configure-process')

    configureEarlyUserDataPath(false)
    hasSwitch.mockReturnValueOnce(true)
    configureEarlyUserDataPath(true)

    expect(app.setPath).not.toHaveBeenCalled()
  })
})
