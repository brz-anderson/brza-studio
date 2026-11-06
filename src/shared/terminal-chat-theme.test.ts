import { describe, expect, it } from 'vitest'
import { getDefaultSettings } from './constants'
import { resolveSavedTerminalColors } from './terminal-chat-theme'
import { TERMINAL_THEME_CATALOG } from './terminal-themes/terminal-theme-catalog'

const settings = { ...getDefaultSettings('/tmp'), theme: 'dark' as const }

describe('resolveSavedTerminalColors', () => {
  it('follows the chat theme with the color overrides on top, as the live pane does', () => {
    const followed = {
      ...settings,
      terminalColorOverrides: { background: '#101820', foreground: '#f0f4f8' },
      nativeChatAppearance: { themeDark: 'Builtin Tango Light' }
    }
    expect(resolveSavedTerminalColors(followed, true)).toEqual({
      foreground: '#f0f4f8',
      background: '#101820'
    })
    expect(resolveSavedTerminalColors({ ...followed, terminalColorOverrides: {} }, true)).toEqual({
      foreground: TERMINAL_THEME_CATALOG['Builtin Tango Light'].foreground,
      background: TERMINAL_THEME_CATALOG['Builtin Tango Light'].background
    })
  })

  it('reads the overrides of the slot the app mode paints while following the chat', () => {
    const light = {
      ...settings,
      theme: 'light' as const,
      terminalUseSeparateLightTheme: true,
      terminalColorOverrides: { background: '#101820' },
      terminalColorOverridesLight: { background: '#fafafa' }
    }
    expect(resolveSavedTerminalColors(light, false).background).toBe('#fafafa')
    expect(
      resolveSavedTerminalColors({ ...light, terminalUseSeparateLightTheme: false }, false)
        .background
    ).toBe('#101820')
  })

  it('applies the overrides of the slot while the terminal keeps its own theme', () => {
    const own = {
      ...settings,
      terminalFollowsChatTheme: false,
      terminalColorOverrides: { background: '#101820', foreground: '#f0f4f8' }
    }
    expect(resolveSavedTerminalColors(own, true)).toEqual({
      foreground: '#f0f4f8',
      background: '#101820'
    })
  })
})
