import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Sync with config/scripts/mac-ad-hoc-marker.cjs, which stamps it at packaging.
export const AD_HOC_SIGNED_MARKER_FILENAME = 'ad-hoc-signed'

/** Why: the version cannot tell; the packaging step alone knows the bundle was signed ad hoc. */
export function isAdHocSignedBuild(): boolean {
  const resourcesPath: unknown = process.resourcesPath
  if (process.platform !== 'darwin' || typeof resourcesPath !== 'string' || !resourcesPath) {
    return false
  }
  return existsSync(join(resourcesPath, AD_HOC_SIGNED_MARKER_FILENAME))
}
