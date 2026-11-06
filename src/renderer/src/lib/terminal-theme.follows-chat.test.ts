import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TERMINAL_THEME_DARK,
  DEFAULT_TERMINAL_THEME_LIGHT
} from '../../../shared/terminal-themes/terminal-theme-selection'
import { getBuiltinTheme, resolveEffectiveTerminalAppearance } from './terminal-theme'

describe('resolveEffectiveTerminalAppearance while the terminal follows the chat', () => {
  const settings = {
    theme: 'dark' as const,
    terminalThemeDark: DEFAULT_TERMINAL_THEME_DARK,
    terminalDividerColorDark: '#3f3f46',
    terminalUseSeparateLightTheme: true,
    terminalThemeLight: DEFAULT_TERMINAL_THEME_LIGHT,
    terminalDividerColorLight: '#d4d4d8',
    nativeChatAppearance: { themeDark: DEFAULT_TERMINAL_THEME_LIGHT }
  }

  it('takes the mode and divider from the chat theme', () => {
    const appearance = resolveEffectiveTerminalAppearance(settings, true)

    expect(appearance).toMatchObject({
      mode: 'light',
      themeName: DEFAULT_TERMINAL_THEME_LIGHT,
      dividerColor: '#d4d4d8'
    })
    expect(appearance.theme?.background).toBe(
      getBuiltinTheme(DEFAULT_TERMINAL_THEME_LIGHT)?.background
    )
  })

  it('keeps the terminal theme when the terminal stops following the chat', () => {
    const appearance = resolveEffectiveTerminalAppearance(
      { ...settings, terminalFollowsChatTheme: false },
      true
    )

    expect(appearance).toMatchObject({ mode: 'dark', themeName: DEFAULT_TERMINAL_THEME_DARK })
  })
})
