import type { App } from 'electron'
import { BRAND_PROTOCOL_SCHEME } from '../../shared/brand-identity'

/**
 * Registers BRAND_PROTOCOL_SCHEME (`brza-studio://`; upstream Orca owns `orca://`) with Windows,
 * which NSIS installs leave unregistered; macOS reads it from Info.plist and Linux packages from
 * the desktop entry. Only packaged desktop launches register,
 * so dev, test and serve runs never take over the machine's handler.
 */
export function registerOrcaProtocolClient(
  app: Pick<App, 'isPackaged' | 'isDefaultProtocolClient' | 'setAsDefaultProtocolClient'>,
  options: { platform: NodeJS.Platform; desktopLaunch: boolean }
): boolean {
  if (options.platform !== 'win32' || !app.isPackaged || !options.desktopLaunch) {
    return false
  }
  if (app.isDefaultProtocolClient(BRAND_PROTOCOL_SCHEME)) {
    return false
  }
  try {
    return app.setAsDefaultProtocolClient(BRAND_PROTOCOL_SCHEME)
  } catch (error) {
    console.warn(`[protocol] Failed to register ${BRAND_PROTOCOL_SCHEME}:// links:`, error)
    return false
  }
}
