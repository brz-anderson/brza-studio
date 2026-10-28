import { join } from 'node:path'
import { BRAND_CLI_COMMAND_NAME } from '../../shared/brand-identity'

// Why `orca-ide` on Linux: GNOME Orca ships /usr/bin/orca, so the CLI never claims that name.
export const LINUX_CLI_COMMAND_NAME = 'orca-ide'

// Keep path-only callers independent of cli-installer's Electron dependency.
export function getBundledLauncherPath(
  platform: NodeJS.Platform,
  resourcesPath: string
): string | null {
  if (platform === 'darwin') {
    return join(resourcesPath, 'bin', BRAND_CLI_COMMAND_NAME)
  }
  if (platform === 'linux') {
    return join(resourcesPath, 'bin', LINUX_CLI_COMMAND_NAME)
  }
  if (platform === 'win32') {
    return join(resourcesPath, 'bin', `${BRAND_CLI_COMMAND_NAME}.exe`)
  }
  return null
}

/** Windows keeps the `orca` alias out of the user-PATH bin so it never shadows upstream Orca's command. */
export function getBundledTerminalAliasDir(
  platform: NodeJS.Platform,
  resourcesPath: string
): string | null {
  return platform === 'win32' ? join(resourcesPath, 'terminal-bin') : null
}
