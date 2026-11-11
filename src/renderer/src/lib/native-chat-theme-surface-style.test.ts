import { describe, expect, it } from 'vitest'
import { resolveNativeChatTheme } from '../../../shared/native-chat-theme'
import { BRZA_DARK_THEME_NAME } from '../../../shared/terminal-themes/defaults'
import { nativeChatThemeSurfaceStyle } from './native-chat-theme-surface-style'

const theme = (themeDark?: string) =>
  resolveNativeChatTheme({ theme: 'dark', nativeChatAppearance: { themeDark } }, true)

describe('nativeChatThemeSurfaceStyle', () => {
  it('paints the BrzA Dark Theme on the graphite canvas, with the focused fill at rest', () => {
    const resolved = theme(BRZA_DARK_THEME_NAME)
    const style = nativeChatThemeSurfaceStyle(resolved)

    expect(resolved).toMatchObject({
      themeName: BRZA_DARK_THEME_NAME,
      scheme: 'dark',
      canvas: '#24272c'
    })
    expect(style['--chat-composer-resting-fill']).toContain('var(--chat-composer-focus-fill)')
  })

  it('leaves the resting fill to the themes that do not ask for it', () => {
    expect(
      nativeChatThemeSurfaceStyle(theme('Dracula'))['--chat-composer-resting-fill']
    ).toBeUndefined()
    expect(nativeChatThemeSurfaceStyle(theme())['--chat-composer-resting-fill']).toBeUndefined()
  })

  it('yields the plugin text tokens and sets a selection mix for a catalog theme', () => {
    const style = nativeChatThemeSurfaceStyle(theme('Dracula'))

    const yielded: `--${string}`[] = [
      '--chat-bold-foreground',
      '--chat-muted-foreground',
      '--chat-inline-code',
      '--chat-inline-code-foreground',
      '--chat-code-block',
      '--chat-selection',
      '--chat-selection-foreground',
      '--text-link'
    ]
    for (const token of yielded) {
      expect(style[token]).toBe('initial')
    }
    expect(style['--chat-selection-mix']).toMatch(/^\d+(\.\d+)?%$/)
    expect(String(style['--chat-link'])).toMatch(/^color-mix\(in srgb, #[0-9a-f]{6} 70%, /)
  })

  it('leaves the BrzA default to the app tokens', () => {
    const style = nativeChatThemeSurfaceStyle(theme())

    expect(style['--chat-selection']).toBeUndefined()
    expect(style['--chat-selection-mix']).toBeUndefined()
  })
})
