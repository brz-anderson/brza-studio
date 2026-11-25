import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installFakeAppEnvironment } from '../../../../config/scripts/test-runtime/environment/vitest-host-ports-setup'
import { prependOrcaCliDirToChildPath } from './orca-cli-child-path'

const USER_DATA = '/data/orca'

beforeEach(() => installFakeAppEnvironment())
afterEach(() => installFakeAppEnvironment())

describe('prependOrcaCliDirToChildPath coexistence', () => {
  // Coexistence: the `orca` alias stays in terminal-bin, a dir only app terminals see, so it never
  // shadows upstream Orca's command on the user PATH (see getBundledTerminalAliasDir).
  it('leads packaged Windows PATH with the bundled CLI dir and the terminal alias dir', () => {
    const resources = join(USER_DATA, 'resources')
    const env: Record<string, string> = { Path: 'C:\\Windows\\System32' }
    prependOrcaCliDirToChildPath(env, {
      isPackaged: true,
      userDataPath: USER_DATA,
      resourcesPath: resources,
      platform: 'win32'
    })
    expect(env.Path).toBe(
      `${join(resources, 'bin')};${join(resources, 'terminal-bin')};C:\\Windows\\System32`
    )
    expect(env.PATH).toBeUndefined()
  })
})
