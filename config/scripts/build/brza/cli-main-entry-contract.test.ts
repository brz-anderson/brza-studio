import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BRAND_WINDOWS_EXECUTABLE_NAME,
  BRAND_WINDOWS_UNINSTALLER_NAME
} from '../../../../src/shared/brand-identity'
import { CLI_MAIN_ENTRY_NAMES } from '../../../build-plugins/cli-main-entry-names'
import { MAIN_BUILD_ENTRY_POINTS } from '../../../build-plugins/main-build-entry-points'

const require = createRequire(import.meta.url)
const builderConfig = require('../../../electron-builder.config.cjs') as {
  asarUnpack: string[]
  productName: string
  win: { executableName: string }
}

// Why: the 251 sync moved command-path-resolver and the fork's entry kept the old path, which broke
// the build; no other test pins these lists against the source tree.
describe('CLI main entries', () => {
  it('every CLI_MAIN_ENTRY_NAMES name has a source file', () => {
    const missing = CLI_MAIN_ENTRY_NAMES.filter(
      (name) => !existsSync(resolve(`src/main/${name}.ts`))
    )
    expect(missing).toEqual([])
  })

  it('every CLI main entry is a build input', () => {
    expect(CLI_MAIN_ENTRY_NAMES.filter((name) => !(name in MAIN_BUILD_ENTRY_POINTS))).toEqual([])
  })

  it('unpacks the fork command-path-resolver entry, which the CLI loads outside the asar', () => {
    expect(CLI_MAIN_ENTRY_NAMES).toContain('ipc/command-path/command-path-resolver')
    expect(builderConfig.asarUnpack).toContain('out/main/ipc/command-path/command-path-resolver.js')
  })

  it('every unpacked out/main file has a source file or a build entry', () => {
    const stale = builderConfig.asarUnpack
      .filter((entry) => /^out\/main\/.+\.js$/.test(entry) && !/[*{]/.test(entry))
      .map((entry) => entry.slice('out/main/'.length, -'.js'.length))
      .filter(
        (name) => !(name in MAIN_BUILD_ENTRY_POINTS) && !existsSync(resolve(`src/main/${name}.ts`))
      )
    expect(stale).toEqual([])
  })
})

// Why: the Windows updater recognises an installed folder by these names; the NSIS uninstaller is
// `Uninstall ${productName}.exe` by electron-builder default.
describe('Windows install names', () => {
  it('match what electron-builder packages', () => {
    expect(BRAND_WINDOWS_EXECUTABLE_NAME).toBe(`${builderConfig.win.executableName}.exe`)
    expect(BRAND_WINDOWS_UNINSTALLER_NAME).toBe(`Uninstall ${builderConfig.productName}.exe`)
  })
})
