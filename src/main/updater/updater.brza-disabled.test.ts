import { beforeEach, describe, expect, it, vi } from 'vitest'
import { updaterMainWindow } from './testing/updater-test-main-window'

const mocks = vi.hoisted(() => {
  const handlers = new Map<string, (() => void)[]>()
  const app = {
    isPackaged: true,
    getVersion: vi.fn(() => '1.4.263'),
    on: vi.fn((event: string, handler: () => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler])
      return app
    }),
    prependListener: vi.fn(),
    emit: (event: string) => handlers.get(event)?.forEach((handler) => handler()),
    quit: vi.fn()
  }
  const autoUpdater = {
    on: vi.fn(() => autoUpdater),
    checkForUpdates: vi.fn(),
    setFeedURL: vi.fn()
  }
  return { app, autoUpdater, fetchNudge: vi.fn(async () => null), handlers }
})

const adHocSignedBuild = vi.hoisted(() => ({ value: false }))
vi.mock('./ad-hoc-signed-build', () => ({ isAdHocSignedBuild: () => adHocSignedBuild.value }))
vi.mock('electron', () => ({
  app: mocks.app,
  BrowserWindow: { getAllWindows: () => [] },
  autoUpdater: { on: vi.fn() },
  powerMonitor: { on: vi.fn() },
  shell: { showItemInFolder: vi.fn() },
  net: { fetch: vi.fn() }
}))
vi.mock('electron-updater', () => ({ autoUpdater: mocks.autoUpdater }))
vi.mock('./electron-updater-loader', () => ({ loadElectronAutoUpdater: () => mocks.autoUpdater }))
vi.mock('./nudges/nudge-campaign', () => ({
  fetchNudge: mocks.fetchNudge,
  shouldApplyNudge: vi.fn(() => false)
}))
vi.mock('./updater-lifecycle-diagnostics', () => ({ recordUpdaterLifecycle: vi.fn() }))
vi.mock('./releases/updater-changelog', () => ({ fetchChangelog: vi.fn(async () => null) }))
vi.mock('../ipc/pty/kill-all', () => ({ killAllPty: vi.fn() }))

// BrzA Studio: a build the fork rebuilds from source, or signs ad hoc, never updates itself (P76).
describe('updater in a build that is not released', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.handlers.clear()
    mocks.app.isPackaged = true
    mocks.app.getVersion.mockReturnValue('1.4.263')
    adHocSignedBuild.value = false
  })

  it('never polls the nudge feed or checks for updates from an ad hoc signed build', async () => {
    adHocSignedBuild.value = true
    const { setupAutoUpdater } = await import('./updater-service')

    setupAutoUpdater(updaterMainWindow(vi.fn()), { getLastUpdateCheckAt: () => null })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mocks.fetchNudge).not.toHaveBeenCalled()
    expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled()
  })

  it('never checks for updates from a local build, which is rebuilt from source', async () => {
    mocks.app.getVersion.mockReturnValue('1.4.239-local.1792864792.eabec4de25f')
    const { setupAutoUpdater, checkForUpdatesFromMenu, getRemoteServerUpdateSupport } =
      await import('./updater-service')

    setupAutoUpdater(updaterMainWindow(vi.fn()), { getLastUpdateCheckAt: () => 0 })
    mocks.app.emit('browser-window-focus')
    checkForUpdatesFromMenu()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mocks.autoUpdater.setFeedURL).not.toHaveBeenCalled()
    expect(mocks.autoUpdater.checkForUpdates).not.toHaveBeenCalled()
    expect(mocks.fetchNudge).not.toHaveBeenCalled()
    expect(getRemoteServerUpdateSupport()).toMatchObject({
      automatic: false,
      reason: 'unpackaged-build'
    })
  })
})
