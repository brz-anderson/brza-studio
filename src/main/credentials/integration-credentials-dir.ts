import { homedir } from 'node:os'
import { join } from 'node:path'
import { BRAND_CREDENTIALS_DIR_NAME } from '../../shared/brand-identity'

/** Sealed with this app's safeStorage key, so it cannot share `~/.orca` with the upstream Orca app. */
export function getIntegrationCredentialsDir(): string {
  return join(homedir(), BRAND_CREDENTIALS_DIR_NAME)
}
