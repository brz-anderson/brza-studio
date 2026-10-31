import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import { buildFontFamily } from '@/lib/monospace-font-family'
import { buildAppFontFamily } from '@/lib/app-font-family'
import * as terminalThemeSelection from '../../../../shared/terminal-theme-selection'
import { nativeChatContrastMix } from '../../../../shared/native-chat-theme'
import { TERMINAL_THEME_CATALOG } from '../../../../shared/terminal-themes'
import { nativeChatAppearanceStyle } from './native-chat-appearance-style'

const makeSettings = createGlobalSettingsFixture
const DARK_THEME = 'Ghostty Default Style Dark'
const LIGHT_THEME = 'Builtin Tango Light'
afterEach(() => vi.restoreAllMocks())

describe('nativeChatContrastMix', () => {
  it.each([
    [50, false, 56],
    [100, false, 78],
    [150, false, 100],
    [50, true, 64],
    [100, true, 82],
    [150, true, 100],
    [-100, false, 56],
    [200, true, 100],
    [Number.NaN, false, 78]
  ])('maps %s in light mode %s to %s', (contrast, light, expected) => {
    expect(nativeChatContrastMix(contrast, light)).toBe(expected)
  })
})

describe('nativeChatAppearanceStyle chat theme', () => {
  it('uses a custom chat family and the terminal code font, with or without a catalog theme', () => {
    const settings = makeSettings({
      appFontFamily: 'Arial',
      terminalFontFamily: 'Menlo',
      nativeChatAppearance: { fontFamily: 'Georgia' }
    })
    const style = nativeChatAppearanceStyle(settings)
    expect(style['--chat-font-family']).toBe(buildAppFontFamily('Georgia'))
    expect(style['--chat-code-font-family']).toBe(buildFontFamily('Menlo'))
    expect(
      nativeChatAppearanceStyle({
        ...settings,
        nativeChatAppearance: { ...settings.nativeChatAppearance, themeDark: DARK_THEME }
      })['--chat-font-family']
    ).toBe(buildAppFontFamily('Georgia'))
    expect(
      nativeChatAppearanceStyle({
        ...settings,
        nativeChatAppearance: { fontFamily: '' }
      })['--chat-font-family']
    ).toBeUndefined()
  })
  it('follows the terminal code font while keeping default body font and colors', () => {
    const style = nativeChatAppearanceStyle(makeSettings({ terminalFontFamily: 'Menlo' }))
    expect(style['--chat-code-font-family']).toBe(buildFontFamily('Menlo'))
    expect(style['--chat-font-family']).toBeUndefined()
    expect(style['--chat-source-foreground']).toBeUndefined()
    expect(style['--chat-source-background']).toBeUndefined()
    expect(style['--chat-foreground-mix']).toBe('78%')
  })

  it('paints a catalog theme from its colors and applies the contrast formula', () => {
    const settings = makeSettings({
      theme: 'dark',
      nativeChatAppearance: { themeDark: DARK_THEME, contrast: 150 },
      terminalColorOverrides: { background: '#122033', foreground: '#ddeeff' }
    })
    const style = nativeChatAppearanceStyle(settings)
    expect(style).toMatchObject({
      colorScheme: 'dark',
      '--chat-source-background': TERMINAL_THEME_CATALOG[DARK_THEME].background,
      '--chat-source-foreground': TERMINAL_THEME_CATALOG[DARK_THEME].foreground,
      '--chat-canvas-mix': '0%',
      '--chat-foreground-mix': '100%',
      '--chat-code-base': 'transparent'
    })
    expect(
      nativeChatAppearanceStyle({
        ...settings,
        nativeChatAppearance: { themeDark: DARK_THEME }
      })['--chat-foreground-mix']
    ).toBe('78%')
  })

  it('resolves imported themes and falls back to the BrzA default when the theme was removed', () => {
    const settings = makeSettings({
      terminalCustomThemes: [
        {
          id: 'manual:sample',
          name: 'Sample',
          source: 'manual',
          mode: 'dark',
          terminal: { background: '#122033', foreground: '#ddeeff', black: '#000001' },
          importedAt: '2026-10-05T00:00:00.000Z'
        }
      ],
      nativeChatAppearance: { themeDark: 'custom:manual:sample' }
    })
    expect(nativeChatAppearanceStyle(settings)['--chat-source-background']).toBe('#122033')
    const missing = nativeChatAppearanceStyle({ ...settings, terminalCustomThemes: [] })
    expect(missing['--chat-source-background']).toBeUndefined()
    expect(missing.colorScheme).toBeUndefined()
  })

  it('uses light formulas for a light theme inside a dark app', () => {
    const style = nativeChatAppearanceStyle(
      makeSettings({ theme: 'dark', nativeChatAppearance: { themeDark: LIGHT_THEME } })
    )
    expect(style).toMatchObject({
      colorScheme: 'light',
      '--chat-source-background': TERMINAL_THEME_CATALOG[LIGHT_THEME].background,
      '--chat-foreground-mix': '82%',
      '--chat-strong-mix': '92%',
      '--chat-code-base': 'var(--chat-canvas)'
    })
  })

  it('follows the separate light theme and system theme changes', () => {
    const settings = makeSettings({
      theme: 'system',
      nativeChatAppearance: {
        themeDark: DARK_THEME,
        useSeparateLightTheme: true,
        themeLight: LIGHT_THEME
      }
    })
    const dark = nativeChatAppearanceStyle(settings, undefined, true)
    const light = nativeChatAppearanceStyle(settings, undefined, false)
    expect(dark['--chat-source-background']).toBe(TERMINAL_THEME_CATALOG[DARK_THEME].background)
    expect(light['--chat-source-background']).toBe(TERMINAL_THEME_CATALOG[LIGHT_THEME].background)
    expect(light.colorScheme).toBe('light')
  })

  it('uses app light contrast for the BrzA default and leaves the app tokens in place', () => {
    const style = nativeChatAppearanceStyle(
      makeSettings({ theme: 'light', nativeChatAppearance: { contrast: 50 } })
    )
    expect(style['--chat-foreground-mix']).toBe('64%')
    expect(style['--chat-font-family']).toBeUndefined()
    expect(style['--chat-canvas-mix']).toBeUndefined()
  })

  it('keeps the chat sizes and contrast with a catalog theme, whatever the terminal size', () => {
    const style = nativeChatAppearanceStyle(
      makeSettings({
        terminalFontSize: 17,
        nativeChatAppearance: {
          fontSize: 20,
          codeFontSize: 10,
          contrast: 50,
          themeDark: DARK_THEME
        }
      })
    )
    expect(style).toMatchObject({
      '--chat-font-size': '20px',
      '--chat-code-font-size': '10px',
      '--chat-foreground-mix': '56%'
    })
  })
})

describe('chat root appearance style', () => {
  it('derives wrap capacity from actual column width, including full-width panes', () => {
    const wide = nativeChatAppearanceStyle({ nativeChatAppearance: { width: 'wide' } })
    const full = nativeChatAppearanceStyle({ nativeChatAppearance: { width: 'full' } }, 1200)
    expect(wide['--chat-estimated-chars-per-line']).toBeGreaterThan(96)
    expect(full['--chat-estimated-chars-per-line']).toBeGreaterThan(
      wide['--chat-estimated-chars-per-line']
    )
    expect(nativeChatAppearanceStyle(undefined, 384)['--chat-estimated-chars-per-line']).toBe(50)
  })

  it.each(['light', 'dark', 'system'] as const)(
    'leaves native controls app-owned in %s mode on the BrzA default',
    (theme) => {
      for (const nativeChatAppearance of [
        undefined,
        { themeDark: 'brza:default' },
        { contrast: 150 }
      ]) {
        const style = nativeChatAppearanceStyle(makeSettings({ theme, nativeChatAppearance }))
        expect(style.colorScheme).toBeUndefined()
        expect(style.color).toBeUndefined()
      }
    }
  )

  it('clamps sizes on read and derives the column width', () => {
    expect(
      nativeChatAppearanceStyle({
        nativeChatAppearance: { fontSize: 25, codeFontSize: 1, width: 'wide' }
      })
    ).toMatchObject({
      '--chat-font-size': '20px',
      '--chat-code-font-size': '10px',
      '--chat-content-max-width': '60rem'
    })
    expect(
      nativeChatAppearanceStyle({ nativeChatAppearance: { width: 'full' } })[
        '--chat-content-max-width'
      ]
    ).toBe('none')
  })
})

describe('contrast hierarchy and incomplete theme palettes', () => {
  it.each(['light', 'dark'] as const)(
    'keeps strong text above body in %s mode up to the cap',
    (theme) => {
      for (const themeDark of [undefined, theme === 'light' ? LIGHT_THEME : DARK_THEME]) {
        for (let contrast = 50; contrast <= 150; contrast++) {
          const style = nativeChatAppearanceStyle(
            makeSettings({ theme, nativeChatAppearance: { contrast, themeDark } })
          )
          const body = Number.parseFloat(String(style['--chat-foreground-mix']))
          const strong = Number.parseFloat(String(style['--chat-strong-mix']))
          expect(strong).toBe(Math.min(100, body + (theme === 'light' ? 10 : 12)))
          if (body < 100) {
            expect(strong).toBeGreaterThan(body)
          }
        }
      }
    }
  )

  it.each([{}, { background: '#ffffff' }, { foreground: '#000000' }])(
    'falls back to the BrzA default for an incomplete palette %j',
    (colors) => {
      vi.spyOn(terminalThemeSelection, 'lookupTerminalTheme').mockReturnValue(colors)
      for (const theme of ['light', 'dark'] as const) {
        const style = nativeChatAppearanceStyle(
          makeSettings({ theme, nativeChatAppearance: { themeDark: DARK_THEME } })
        )
        expect(style['--chat-source-background']).toBeUndefined()
        expect(style.colorScheme).toBeUndefined()
      }
    }
  )
})
