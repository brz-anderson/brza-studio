// BrzA Studio identity that must differ from upstream Orca so both apps run side by side.
// Keep in sync: config/electron-builder.config.cjs, config/nsis/orca-installer-hooks.nsh,
// config/scripts/dev-instance-isolation.mjs and the launchers under resources/*/bin.

/** Packaged userData folder under appData; upstream Orca owns `orca`. */
export const BRAND_USER_DATA_DIR_NAME = 'brza-studio'
/** Shared and per-worktree dev profiles; upstream dev owns `orca-dev` and `orca-dev-wt`. */
export const BRAND_DEV_USER_DATA_DIR_NAME = 'brza-dev'
export const BRAND_DEV_WORKTREE_USER_DATA_DIR_NAME = 'brza-dev-wt'
/** Applied before ready so macOS safeStorage uses the `BrzA Studio Safe Storage` Keychain item. */
export const BRAND_APP_NAME = 'BrzA Studio'
/** Packaged terminal command; upstream Orca owns `orca`. */
export const BRAND_CLI_COMMAND_NAME = 'brza'
/** OS-registered URL scheme. Pairing keeps `orca://pair`: the Orca mobile app only accepts that. */
export const BRAND_PROTOCOL_SCHEME = 'brza-studio'
/** Runtime WebSocket ports, with a fallback ladder clear of upstream's 6768-6799. */
export const BRAND_DEFAULT_WS_PORT = 6868
export const BRAND_DEV_WS_PORT = 6869
/** %LOCALAPPDATA% root for relocated Windows daemon hosts; upstream Orca owns `Orca`. */
export const BRAND_LOCAL_HOST_ROOT_NAME = 'BrzA Studio'

export function isBrandDevUserDataPath(userDataPath: string | undefined): boolean {
  return userDataPath?.includes(BRAND_DEV_USER_DATA_DIR_NAME) ?? false
}
