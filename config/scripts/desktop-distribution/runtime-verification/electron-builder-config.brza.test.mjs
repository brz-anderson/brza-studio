import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import {
  BRAND_APP_NAME,
  BRAND_CLI_COMMAND_NAME,
  BRAND_PROTOCOL_SCHEME,
  BRAND_USER_DATA_DIR_NAME
} from '../../../../src/shared/brand-identity'

const require = createRequire(import.meta.url)
const electronBuilderConfig = require('../../../electron-builder.config.cjs')

describe('electron-builder config', () => {
  // The .cjs config cannot import src/shared/brand-identity.ts; this keeps both apart from upstream Orca.
  it('packages the identity BrzA Studio needs beside upstream Orca', () => {
    expect(electronBuilderConfig.extraMetadata.name).toBe(BRAND_USER_DATA_DIR_NAME)
    expect(electronBuilderConfig.protocols).toEqual([
      { name: BRAND_APP_NAME, schemes: [BRAND_PROTOCOL_SCHEME] }
    ])
    expect(electronBuilderConfig.mac.executableName).toBe(BRAND_APP_NAME)
    expect(electronBuilderConfig.win.executableName).toBe(BRAND_APP_NAME)
    expect(electronBuilderConfig.mac.extraResources).toContainEqual({
      from: 'resources/darwin/bin/orca',
      to: `bin/${BRAND_CLI_COMMAND_NAME}`
    })
    expect(electronBuilderConfig.win.extraResources).toContainEqual({
      from: 'native/windows-cli-launcher/.build/orca.exe',
      to: `bin/${BRAND_CLI_COMMAND_NAME}.exe`
    })
  })
})
