import { existsSync } from 'node:fs'
import { join } from 'node:path'

// Sync with config/scripts/mac-ad-hoc-marker.cjs, which stamps it at packaging.
export const AD_HOC_SIGNED_MARKER_FILENAME = 'ad-hoc-signed'

// The marker is stamped at packaging and never changes while the app runs; one stat per resources folder.
const markerByResourcesPath = new Map<string, boolean>()

/** Why: the version cannot tell; the packaging step alone knows the bundle was signed ad hoc. */
export function isAdHocSignedBuild(): boolean {
  const resourcesPath: unknown = process.resourcesPath
  if (process.platform !== 'darwin' || typeof resourcesPath !== 'string' || !resourcesPath) {
    return false
  }
  let present = markerByResourcesPath.get(resourcesPath)
  if (present === undefined) {
    present = existsSync(join(resourcesPath, AD_HOC_SIGNED_MARKER_FILENAME))
    markerByResourcesPath.set(resourcesPath, present)
  }
  return present
}
