import { describe, expect, it } from 'vitest'
import { NATIVE_CHAT_THEME_BRZA_DEFAULT } from './native-chat-appearance-settings'
import { resolveNativeChatTheme } from './native-chat-theme'
import { TERMINAL_THEME_CATALOG } from './terminal-themes'

describe('resolveNativeChatTheme', () => {
  it('keeps the chat canvas of before as the BrzA default, following the app scheme', () => {
    const dark = resolveNativeChatTheme({ theme: 'dark' }, true)
    expect(dark).toMatchObject({
      themeName: NATIVE_CHAT_THEME_BRZA_DEFAULT,
      scheme: 'dark',
      followsAppScheme: true,
      background: '#0a0a0a',
      foreground: '#fafafa',
      canvas: '#161616',
      foregroundMix: 78,
      strongMix: 90
    })
    expect(dark.palette.red).toBe(TERMINAL_THEME_CATALOG['Ghostty Default Style Dark'].red)

    const light = resolveNativeChatTheme({ theme: 'system' }, false)
    expect(light).toMatchObject({ scheme: 'light', canvas: '#ffffff', foregroundMix: 82 })
    expect(light.palette.red).toBe(TERMINAL_THEME_CATALOG['Builtin Tango Light'].red)
  })

  it('switches to the light theme of the pair only while the app is light and the pair asks for it', () => {
    const nativeChatAppearance = {
      themeDark: 'Ghostty Default Style Dark',
      useSeparateLightTheme: true,
      themeLight: 'Builtin Tango Light'
    }
    expect(resolveNativeChatTheme({ theme: 'dark', nativeChatAppearance }, false)).toMatchObject({
      themeName: 'Ghostty Default Style Dark',
      scheme: 'dark',
      followsAppScheme: false
    })
    expect(resolveNativeChatTheme({ theme: 'light', nativeChatAppearance }, true)).toMatchObject({
      themeName: 'Builtin Tango Light',
      scheme: 'light',
      background: TERMINAL_THEME_CATALOG['Builtin Tango Light'].background
    })
    expect(
      resolveNativeChatTheme(
        {
          theme: 'light',
          nativeChatAppearance: { ...nativeChatAppearance, useSeparateLightTheme: false }
        },
        true
      ).themeName
    ).toBe('Ghostty Default Style Dark')
  })

  it('paints a catalog theme with its own background and applies the contrast to the text', () => {
    const settings = {
      theme: 'dark' as const,
      nativeChatAppearance: { themeDark: 'Ghostty Default Style Dark' }
    }
    expect(resolveNativeChatTheme(settings, true)).toMatchObject({
      background: '#282c34',
      canvas: '#282c34',
      canvasMix: 0,
      foregroundMix: 78,
      text: '#d0d1d2'
    })
    expect(
      resolveNativeChatTheme(
        { ...settings, nativeChatAppearance: { ...settings.nativeChatAppearance, contrast: 150 } },
        true
      )
    ).toMatchObject({ canvas: '#282c34', foregroundMix: 100, strongMix: 100, text: '#ffffff' })
  })

  it('resolves imported themes and falls back to the BrzA default when the theme is gone', () => {
    const terminalCustomThemes = [
      {
        id: 'manual:paper',
        name: 'Paper',
        source: 'manual' as const,
        mode: 'light' as const,
        terminal: { background: '#f4f1e8', foreground: '#222222', red: '#aa3333' },
        importedAt: '2026-10-29T00:00:00.000Z'
      }
    ]
    expect(
      resolveNativeChatTheme(
        {
          theme: 'dark',
          terminalCustomThemes,
          nativeChatAppearance: { themeDark: 'custom:manual:paper' }
        },
        true
      )
    ).toMatchObject({ scheme: 'light', canvas: '#f4f1e8', followsAppScheme: false })
    expect(
      resolveNativeChatTheme(
        { theme: 'dark', nativeChatAppearance: { themeDark: 'custom:gone' } },
        true
      )
    ).toMatchObject({ themeName: NATIVE_CHAT_THEME_BRZA_DEFAULT, canvas: '#161616' })
  })
})
