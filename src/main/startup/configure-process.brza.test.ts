import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => {
  const paths = new Map<string, string>([['appData', '/tmp/app-data']])
  return {
    app: {
      getPath: vi.fn((name: string) => paths.get(name) ?? ''),
      setPath: vi.fn((name: string, value: string) => {
        paths.set(name, value)
      }),
      quit: vi.fn(),
      exit: vi.fn(),
      isPackaged: false,
      disableHardwareAcceleration: vi.fn(),
      commandLine: {
        appendSwitch: vi.fn(),
        getSwitchValue: vi.fn(() => '')
      }
    },
    shell: { openExternal: vi.fn() }
  }
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('configureDevUserDataPath', () => {
  it('moves dev runs onto a brza-dev userData path, apart from upstream orca-dev', async () => {
    const { app } = await import('electron')
    const { configureDevUserDataPath } = await import('./configure-process')
    const originalOverride = process.env.ORCA_DEV_USER_DATA_PATH

    try {
      delete process.env.ORCA_DEV_USER_DATA_PATH
      configureDevUserDataPath(true)
    } finally {
      if (originalOverride === undefined) {
        delete process.env.ORCA_DEV_USER_DATA_PATH
      } else {
        process.env.ORCA_DEV_USER_DATA_PATH = originalOverride
      }
    }

    expect(app.setPath).toHaveBeenCalledWith('userData', join('/tmp/app-data', 'brza-dev'))
  })
})
