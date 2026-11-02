const { writeFileSync } = require('node:fs')
const { join } = require('node:path')

// Sync with src/main/updater/ad-hoc-signed-build.ts, which reads it at runtime.
const MAC_AD_HOC_MARKER_FILENAME = 'ad-hoc-signed'

/** Why: Squirrel.Mac rejects an update over a bundle with no stable signature, so the app turns its updater off. */
function writeMacAdHocMarker(resourcesDir, signingIdentity) {
  if (signingIdentity !== '-') {
    return
  }
  writeFileSync(
    join(resourcesDir, MAC_AD_HOC_MARKER_FILENAME),
    'Signed ad hoc: the updater stays off.\n',
    'utf8'
  )
}

module.exports = { MAC_AD_HOC_MARKER_FILENAME, writeMacAdHocMarker }
