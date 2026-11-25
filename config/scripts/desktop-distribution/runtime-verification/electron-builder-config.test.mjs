import { execFile } from 'node:child_process'
import { chmod, mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, it } from 'vitest'
import {
  BRAND_APP_NAME,
  BRAND_CLI_COMMAND_NAME,
  BRAND_PROTOCOL_SCHEME,
  BRAND_USER_DATA_DIR_NAME
} from '../../../../src/shared/brand-identity'

const REPO_ROOT = join(import.meta.dirname, '../../..', '..')

const require = createRequire(import.meta.url)
const electronBuilderConfig = require('../../../electron-builder.config.cjs')
const { copyFiles, FileMatcher } = require('app-builder-lib/out/fileMatcher')

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

  // Bundled agent-browser answered "No skills found" because only its binary shipped (#17705).
  const hostBuilderPlatform = { darwin: 'mac', linux: 'linux', win32: 'win' }[process.platform]
  it.runIf(hostBuilderPlatform)(
    'ships the agent-browser skill catalog the packaged binary resolves',
    async () => {
      const resourcesDir = await mkdtemp(join(tmpdir(), 'orca-packaged-agent-browser-'))
      try {
        const resources = electronBuilderConfig[hostBuilderPlatform].extraResources.filter(
          (entry) => entry.from.startsWith('node_modules/agent-browser/') || entry.to === 'skills'
        )
        const expand = (value) => value.replace('${arch}', process.arch)
        await copyFiles(
          resources.map(
            (entry) =>
              new FileMatcher(
                join(REPO_ROOT, expand(entry.from)),
                join(resourcesDir, expand(entry.to)),
                (value) => value
              )
          )
        )
        const binary = resources.find((entry) => entry.to.startsWith('agent-browser-'))
        expect(binary).toBeDefined()
        const binaryPath = join(resourcesDir, expand(binary.to))
        // afterPack restores the executable bit; upstream tarball modes vary.
        await chmod(binaryPath, 0o755)
        const { AGENT_BROWSER_SKILLS_DIR: _override, ...env } = process.env
        const { stdout } = await promisify(execFile)(binaryPath, ['skills', 'get', 'core'], {
          env,
          windowsHide: true
        })
        expect(stdout).toContain('name: core')
      } finally {
        await rm(resourcesDir, { recursive: true, force: true })
      }
    }
  )
})
