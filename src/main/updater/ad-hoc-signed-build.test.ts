import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AD_HOC_SIGNED_MARKER_FILENAME, isAdHocSignedBuild } from './ad-hoc-signed-build'

describe('isAdHocSignedBuild', () => {
  const platform = Object.getOwnPropertyDescriptor(process, 'platform')
  const resourcesPath = Object.getOwnPropertyDescriptor(process, 'resourcesPath')
  let resourcesDir: string

  beforeEach(() => {
    resourcesDir = mkdtempSync(join(tmpdir(), 'ad-hoc-marker-'))
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })
    Object.defineProperty(process, 'resourcesPath', { value: resourcesDir, configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(process, 'platform', platform!)
    if (resourcesPath) {
      Object.defineProperty(process, 'resourcesPath', resourcesPath)
    } else {
      Reflect.deleteProperty(process, 'resourcesPath')
    }
    rmSync(resourcesDir, { recursive: true, force: true })
  })

  it('is true when the bundle carries the marker the build stamps for an ad hoc signature', () => {
    writeFileSync(join(resourcesDir, AD_HOC_SIGNED_MARKER_FILENAME), 'ad hoc\n')
    expect(isAdHocSignedBuild()).toBe(true)
  })

  it('is false for a bundle signed with an identity, which carries no marker', () => {
    expect(isAdHocSignedBuild()).toBe(false)
  })

  it('is false when the resources path is unknown', () => {
    Reflect.deleteProperty(process, 'resourcesPath')
    expect(isAdHocSignedBuild()).toBe(false)
  })

  it('ignores the marker off macOS', () => {
    writeFileSync(join(resourcesDir, AD_HOC_SIGNED_MARKER_FILENAME), 'ad hoc\n')
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
    expect(isAdHocSignedBuild()).toBe(false)
  })
})
