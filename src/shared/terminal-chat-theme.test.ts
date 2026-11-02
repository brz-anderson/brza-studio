import { describe, expect, it } from 'vitest'
import { getDefaultSettings } from './constants'
import { resolveSavedTerminalColors } from './terminal-chat-theme'
import { TERMINAL_THEME_CATALOG } from './terminal-themes'

const settings = { ...getDefaultSettings('/tmp'), theme: 'dark' as const }

describe('resolveSavedTerminalColors', () => {
  it('follows the chat theme and leaves the terminal color overrides out, as the live pane does', () => {
    const followed = {
      ...settings,
      terminalColorOverrides: { background: '#101820', foreground: '#f0f4f8' },
      nativeChatAppearance: { themeDark: 'Builtin Tango Light' }
    }
    expect(resolveSavedTerminalColors(followed, true)).toEqual({
      foreground: TERMINAL_THEME_CATALOG['Builtin Tango Light'].foreground,
      background: TERMINAL_THEME_CATALOG['Builtin Tango Light'].background
    })
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
