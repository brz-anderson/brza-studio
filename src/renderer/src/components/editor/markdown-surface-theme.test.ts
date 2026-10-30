import { describe, expect, it } from 'vitest'
import { TERMINAL_THEME_CATALOG } from '../../../../shared/terminal-themes'
import { buildAppFontFamily } from '@/lib/app-font-family'
import { buildFontFamily } from '@/lib/monospace-font-family'
import { markdownSurfaceTheme } from './markdown-surface-theme'

const tangoLight = TERMINAL_THEME_CATALOG['Builtin Tango Light'].background

describe('markdownSurfaceTheme', () => {
  it('follows the chat: its canvas, font, size and scheme in the preview, rich editor and code mode', () => {
    const surface = markdownSurfaceTheme(
      {
        theme: 'dark',
        terminalFontFamily: 'JetBrains Mono',
        nativeChatAppearance: {
          themeDark: 'Ghostty Default Style Dark',
          fontFamily: 'Georgia',
          fontSize: 17
        }
      },
      true
    )
    expect(surface).toMatchObject({
      isDark: true,
      fontSize: 17,
      codeFontFamily: buildFontFamily('JetBrains Mono'),
      codeStyle: { '--markdown-code-canvas': '#282c34' }
    })
    expect(surface.style).toMatchObject({
      backgroundColor: '#282c34',
      '--editor-surface': '#282c34',
      '--background': 'var(--chat-canvas)',
      '--chat-source-background': '#282c34',
      fontFamily: buildAppFontFamily('Georgia'),
      '--font-mono': buildFontFamily('JetBrains Mono'),
      '--markdown-font-size': '17px'
    })
  })

  it("keeps the BrzA default chat on the app's tokens with today's chat canvas", () => {
    const surface = markdownSurfaceTheme({ theme: 'dark' }, true)
    expect(surface.isDark).toBe(true)
    expect(surface.style.backgroundColor).toBe('#161616')
    expect(surface.style).not.toHaveProperty('--background')
    expect(surface.style).not.toHaveProperty('fontFamily')
  })

  it("leaves code mode on Monaco's global theme when the chat's scheme differs from the app's", () => {
    const surface = markdownSurfaceTheme(
      { theme: 'dark', nativeChatAppearance: { themeDark: 'Builtin Tango Light' } },
      true
    )
    expect(surface.isDark).toBe(false)
    expect(surface.style).toMatchObject({ colorScheme: 'light', backgroundColor: tangoLight })
    expect(surface.codeStyle).toBeUndefined()
  })

  it("uses its own theme with today's type when it does not follow the chat", () => {
    const surface = markdownSurfaceTheme(
      {
        theme: 'dark',
        terminalFontFamily: 'JetBrains Mono',
        nativeChatAppearance: { themeDark: 'Ghostty Default Style Dark', fontSize: 17 },
        markdownTheme: { followChat: false, themeDark: 'Builtin Tango Light' }
      },
      true
    )
    expect(surface).toMatchObject({ isDark: false, fontSize: 14, codeFontFamily: undefined })
    expect(surface.style).toMatchObject({
      backgroundColor: tangoLight,
      '--editor-surface': tangoLight,
      '--markdown-font-size': '14px'
    })
    expect(surface.style).not.toHaveProperty('fontFamily')
    expect(surface.style).not.toHaveProperty('--font-mono')
  })
})
