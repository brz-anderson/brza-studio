import { getAppEnvironment, hasAppEnvironment } from '../../shared/app-environment'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import { BRAND_USER_DATA_DIR_NAME } from '../../shared/brand-identity'

// Use the environment port for plain Node hosts. Keep userData/logs on macOS
// because Electron’s logs path would strand existing bundles.
function getUserDataDir(): string {
  if (hasAppEnvironment()) {
    return getAppEnvironment().getPath('userData')
  }
  const home = homedir()
  if (platform() === 'darwin') {
    return join(home, 'Library', 'Application Support', BRAND_USER_DATA_DIR_NAME)
  }
  if (platform() === 'win32') {
    return join(process.env.APPDATA ?? home, BRAND_USER_DATA_DIR_NAME)
  }
  return join(home, '.config', BRAND_USER_DATA_DIR_NAME)
}

export function getLogsDirectory(): string {
  return join(getUserDataDir(), 'logs')
}

export function getTraceFilePath(): string {
  return join(getLogsDirectory(), 'main.trace.ndjson')
}

export function getOrcadTraceFilePath(): string {
  return join(getLogsDirectory(), 'orcad.trace.ndjson')
}

export function getDaemonLogFilePath(): string {
  return join(getLogsDirectory(), 'daemon.log')
}
