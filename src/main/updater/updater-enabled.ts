import { app } from 'electron'
import { isAdHocSignedBuild } from './ad-hoc-signed-build'

// The suffix config/scripts/build-{mac,win}-local.mjs stamp on a local build's version.
const LOCAL_BUILD_VERSION_SUFFIX = /[-.]local\.\d+\.[0-9A-Za-z-]+$/

/** Why: a local build is rebuilt from source, and an ad hoc bundle cannot take an update; the check would only fail. */
export function isUpdaterEnabled(): boolean {
  return (
    app.isPackaged && !LOCAL_BUILD_VERSION_SUFFIX.test(app.getVersion()) && !isAdHocSignedBuild()
  )
}
