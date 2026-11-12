// BrzA: the chat's match-terminal-interface migration (P58-P60), kept apart from the upstream test.
import { homedir } from 'node:os'
import { describe, expect, it } from 'vitest'
import { getDefaultPersistedState } from '../../../shared/constants'
import type { PersistedState } from '../../../shared/persisted-state-types'
import { normalizeLoadedGlobalSettings } from './normalize-loaded-global-settings'
import { prepareLoadedTerminalSettings } from './prepare-loaded-terminal-settings'
import { prepareLoadedProfileSettings } from './prepare-loaded-profile-settings'

function normalizeLegacyProfile(overrides: Record<string, unknown>): PersistedState['settings'] {
  const defaults = getDefaultPersistedState(homedir())
  const parsed: PersistedState = {
    ...defaults,
    settings: { ...defaults.settings, ...overrides }
  }
  const noop = (): void => {}
  const terminal = prepareLoadedTerminalSettings(parsed, noop)
  const profile = prepareLoadedProfileSettings(parsed, defaults, noop)
  return normalizeLoadedGlobalSettings(parsed, terminal, profile)
}

describe('retired chat match terminal interface', () => {
  it('makes the terminal theme pair, font and size the chat own, at the default contrast', () => {
    const normalized = normalizeLegacyProfile({
      terminalThemeDark: 'Dracula',
      terminalUseSeparateLightTheme: true,
      terminalThemeLight: 'Builtin Tango Light',
      terminalFontFamily: 'SF Mono',
      terminalFontSize: 15,
      nativeChatAppearance: { matchTerminalInterface: true, contrast: 130, width: 'full' }
    })
    expect(normalized.nativeChatAppearance).toEqual({
      themeDark: 'Dracula',
      useSeparateLightTheme: true,
      themeLight: 'Builtin Tango Light',
      fontFamily: 'SF Mono',
      fontSize: 15,
      codeFontSize: 15,
      width: 'full'
    })
  })

  it('leaves the chat on the BrzA default when it was off', () => {
    expect(
      normalizeLegacyProfile({
        terminalThemeDark: 'Dracula',
        nativeChatAppearance: { matchTerminalInterface: false, fontSize: 16 }
      }).nativeChatAppearance
    ).toEqual({ fontSize: 16 })
  })
})
