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
})
