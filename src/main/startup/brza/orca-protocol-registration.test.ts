import { describe, expect, it, vi } from 'vitest'
import { registerOrcaProtocolClient } from '../orca-protocol-registration'

// Coexistence with upstream Orca: the OS handler BrzA Studio claims is brza-studio://, never orca://.
describe('registerOrcaProtocolClient of BrzA Studio beside upstream Orca', () => {
  function makeApp(isDefault = false) {
    return {
      isPackaged: true,
      isDefaultProtocolClient: vi.fn(() => isDefault),
      setAsDefaultProtocolClient: vi.fn(() => true)
    }
  }

  it('claims brza-studio:// on a packaged Windows desktop launch', () => {
    const app = makeApp()

    expect(registerOrcaProtocolClient(app, { platform: 'win32', desktopLaunch: true })).toBe(true)

    expect(app.isDefaultProtocolClient).toHaveBeenCalledWith('brza-studio')
    expect(app.setAsDefaultProtocolClient).toHaveBeenCalledWith('brza-studio')
    expect(app.setAsDefaultProtocolClient).not.toHaveBeenCalledWith('orca')
  })

  it('leaves an already registered scheme alone', () => {
    const app = makeApp(true)

    expect(registerOrcaProtocolClient(app, { platform: 'win32', desktopLaunch: true })).toBe(false)
    expect(app.setAsDefaultProtocolClient).not.toHaveBeenCalled()
  })

  it('registers nothing off Windows or outside a desktop launch', () => {
    const app = makeApp()

    expect(registerOrcaProtocolClient(app, { platform: 'darwin', desktopLaunch: true })).toBe(false)
    expect(registerOrcaProtocolClient(app, { platform: 'win32', desktopLaunch: false })).toBe(false)
    expect(app.setAsDefaultProtocolClient).not.toHaveBeenCalled()
  })
})
