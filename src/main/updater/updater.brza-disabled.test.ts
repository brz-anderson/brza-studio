import type { getReleaseDownloadUrl } from './releases/updater-release-readiness'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadUpdaterModule, warmUpdaterModule } from './testing/updater-test-module-loader'
import { updaterMainWindow } from './testing/updater-test-main-window'

const { appMock, autoUpdaterMock, fetchNudgeMock, moduleFactories, resetUpdaterMocks } =
  await vi.hoisted(async () =>
    (await import('./testing/updater-test-harness')).createUpdaterMocks()
  )

const adHocSignedBuild = vi.hoisted(() => ({ value: false }))
vi.mock('./ad-hoc-signed-build', () => ({
  isAdHocSignedBuild: () => adHocSignedBuild.value
}))

vi.mock('electron', () => moduleFactories.electron())
vi.mock('electron-updater', () => moduleFactories.electronUpdater())
vi.mock('./electron-updater-loader', () => moduleFactories.electronUpdaterLoader())
vi.mock('../ipc/pty/kill-all', () => moduleFactories.ptyKillAll())
vi.mock('./linux-package/linux-update-package-type', () => moduleFactories.linuxUpdatePackageType())
vi.mock('./updater-lifecycle-diagnostics', () => moduleFactories.updaterLifecycleDiagnostics())
vi.mock('./releases/updater-changelog', () => moduleFactories.updaterChangelog())
vi.mock('./nudges/nudge-campaign', () => moduleFactories.updaterNudge())
vi.mock('./update-install-exit-watchdog', () => moduleFactories.updateInstallExitWatchdog())
vi.mock('./releases/updater-prerelease-feed', () => moduleFactories.updaterPrereleaseFeed())
vi.mock('./releases/updater-release-readiness', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getReleaseDownloadUrl: (
    await vi.importMock<{
      getReleaseDownloadUrl: typeof getReleaseDownloadUrl
    }>('./releases/updater-prerelease-feed')
  ).getReleaseDownloadUrl
}))
vi.mock('../local-builds/local-build-switch', () => moduleFactories.localBuildSwitch())
vi.mock('../local-builds/local-build-feed-server', () => moduleFactories.localBuildFeedServer())

warmUpdaterModule()

// BrzA Studio: a build the fork rebuilds from source, or signs ad hoc, never updates itself (P76).
describe('updater in a build that is not released', () => {
  beforeEach(() => {
    resetUpdaterMocks()
    adHocSignedBuild.value = false
  })

  it('never polls the nudge feed or checks for updates from an ad hoc signed build', async () => {
    adHocSignedBuild.value = true
    const { setupAutoUpdater } = await loadUpdaterModule()

    setupAutoUpdater(updaterMainWindow(vi.fn()), { getLastUpdateCheckAt: () => null })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchNudgeMock).not.toHaveBeenCalled()
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
  })

  it('never checks for updates from a local build, which is rebuilt from source', async () => {
    vi.useFakeTimers()
    appMock.getVersion.mockReturnValue('1.4.239-local.1792864792.eabec4de25f')
    const mainWindow = updaterMainWindow(vi.fn())

    const { setupAutoUpdater, checkForUpdatesFromMenu, getRemoteServerUpdateSupport } =
      await loadUpdaterModule()

    setupAutoUpdater(mainWindow, { getLastUpdateCheckAt: () => 0 })
    appMock.emit('browser-window-focus')
    checkForUpdatesFromMenu()
    await vi.advanceTimersByTimeAsync(25 * 60 * 60 * 1000)

    expect(autoUpdaterMock.setFeedURL).not.toHaveBeenCalled()
    expect(autoUpdaterMock.checkForUpdates).not.toHaveBeenCalled()
    expect(fetchNudgeMock).not.toHaveBeenCalled()
    expect(getRemoteServerUpdateSupport()).toMatchObject({
      automatic: false,
      reason: 'unpackaged-build'
    })
  })
})
