import { describe, expect, it } from 'vitest'
import { invalidPluginErrorMessage, pluginInstallErrorMessage } from './plugin-error-presentation'

const t = (key: string) => key

describe('plugin error presentation brand spellings', () => {
  it.each(['Orca', 'BrzA Studio'])('flags a version gap emitted with %s', (brand) => {
    expect(invalidPluginErrorMessage(`Plugin requires ${brand} >= 9.0.0`, true, t)).toBe(
      'auto.components.settings.pluginError.incompatible'
    )
  })

  it.each(['Orca', 'BrzA Studio'])('flags a reserved id emitted with %s', (brand) => {
    const message = pluginInstallErrorMessage(
      new Error(`github.x is reserved for official ${brand} plugins`)
    )
    expect(message).toContain('reserved for official')
  })
})
