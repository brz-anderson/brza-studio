import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AD_HOC_SIGNED_MARKER_FILENAME } from '../../src/main/updater/ad-hoc-signed-build'

const require = createRequire(import.meta.url)
const { MAC_AD_HOC_MARKER_FILENAME, writeMacAdHocMarker } = require('./mac-ad-hoc-marker.cjs')

describe('mac ad hoc marker', () => {
  let resourcesDir

  beforeEach(() => {
    resourcesDir = mkdtempSync(join(tmpdir(), 'mac-ad-hoc-marker-'))
  })

  afterEach(() => {
    rmSync(resourcesDir, { recursive: true, force: true })
  })

  it('names the file the app reads at runtime', () => {
    expect(MAC_AD_HOC_MARKER_FILENAME).toBe(AD_HOC_SIGNED_MARKER_FILENAME)
  })

  it('stamps a bundle signed ad hoc', () => {
    writeMacAdHocMarker(resourcesDir, '-')
    expect(existsSync(join(resourcesDir, MAC_AD_HOC_MARKER_FILENAME))).toBe(true)
  })

  it.each([
    ['a named identity', 'Developer ID Application: Someone'],
    ['a release build', null]
  ])('leaves %s unstamped', (_label, identity) => {
    writeMacAdHocMarker(resourcesDir, identity)
    expect(existsSync(join(resourcesDir, MAC_AD_HOC_MARKER_FILENAME))).toBe(false)
  })
})
