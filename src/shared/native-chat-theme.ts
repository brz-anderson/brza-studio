import type { ITheme } from '@xterm/xterm'
import type { GlobalSettings } from './global-settings-types'
import {
  NATIVE_CHAT_THEME_BRZA_DEFAULT,
  resolveNativeChatAppearanceSettings,
  type NativeChatAppearanceSettings
} from './native-chat-appearance-settings'
import {
  DEFAULT_TERMINAL_THEME_DARK,
  DEFAULT_TERMINAL_THEME_LIGHT,
  lookupTerminalTheme,
  selectTerminalTheme
} from './terminal-theme-selection'
import { isTerminalBackgroundLight, mixCssColors } from './terminal-title-contrast'

/** A dark theme, a light theme, and whether the light one is used; shared by the chat and by any
 *  surface that offers its own theme in the chat's catalog. Absent names are the BrzA default. */
export type NativeChatThemePair = Pick<
  NativeChatAppearanceSettings,
  'themeDark' | 'useSeparateLightTheme' | 'themeLight'
>

export type NativeChatThemeContext = Partial<Pick<GlobalSettings, 'theme' | 'terminalCustomThemes'>>

/**
 * The effective chat theme. Contract read by the terminal and the Markdown viewer (PLN-001 D45):
 * - `background`/`foreground`: the theme's own colors, before the chat mixes them.
 * - `palette`: the full xterm palette (16 ANSI, cursor, selection) with those two colors.
 * - `scheme`: light or dark; `followsAppScheme` is true only for the BrzA default.
 * - `canvas`: the chat surface `--chat-canvas` paints, `#rrggbb`.
 * - `foregroundMix`/`strongMix`: body and strong text percent over the canvas, from the contrast;
 *   `text` is the resulting body text color.
 */
export type NativeChatTheme = {
  themeName: string
  scheme: 'dark' | 'light'
  followsAppScheme: boolean
  background: string
  foreground: string
  palette: ITheme
  canvas: string
  canvasMix: number
  foregroundMix: number
  strongMix: number
  text: string
}

// Mirrors the app surfaces and `--chat-canvas-mix` in main.css, so the default chat keeps its look.
const BRZA_DEFAULT_SURFACES = {
  dark: { background: '#0a0a0a', foreground: '#fafafa', canvasMix: 5 },
  light: { background: '#ffffff', foreground: '#0a0a0a', canvasMix: 0 }
} as const

export function nativeChatContrastMix(contrast: number, light: boolean): number {
  const value = Number.isFinite(contrast) ? Math.min(150, Math.max(50, contrast)) : 100
  return light
    ? Math.min(100, Math.max(55, 82 + (value - 100) * 0.36))
    : Math.min(100, Math.max(50, 78 + (value - 100) * 0.44))
}

function themeWithColors(
  theme: ITheme | null
): (ITheme & Required<Pick<ITheme, 'background' | 'foreground'>>) | null {
  return theme?.background && theme.foreground
    ? { ...theme, background: theme.background, foreground: theme.foreground }
    : null
}

/** Resolves a theme pair the way the terminal picks its own, against the chat's contrast. */
export function resolveNativeChatThemePair(
  pair: NativeChatThemePair | undefined,
  context: NativeChatThemeContext,
  systemPrefersDark: boolean,
  contrast = 100
): NativeChatTheme {
  const { mode, themeName } = selectTerminalTheme(
    {
      theme: context.theme ?? 'dark',
      terminalThemeDark: pair?.themeDark || NATIVE_CHAT_THEME_BRZA_DEFAULT,
      terminalUseSeparateLightTheme: pair?.useSeparateLightTheme === true,
      terminalThemeLight: pair?.themeLight || NATIVE_CHAT_THEME_BRZA_DEFAULT
    },
    systemPrefersDark
  )
  const selected =
    themeName === NATIVE_CHAT_THEME_BRZA_DEFAULT
      ? null
      : themeWithColors(lookupTerminalTheme(context, themeName))
  if (selected) {
    const light = isTerminalBackgroundLight(selected.background)
    return withCanvas({
      themeName,
      scheme: light ? 'light' : 'dark',
      followsAppScheme: false,
      palette: selected,
      canvasMix: 0,
      contrast
    })
  }
  const surface = BRZA_DEFAULT_SURFACES[mode]
  const ansi = lookupTerminalTheme(
    context,
    mode === 'light' ? DEFAULT_TERMINAL_THEME_LIGHT : DEFAULT_TERMINAL_THEME_DARK
  )
  return withCanvas({
    themeName: NATIVE_CHAT_THEME_BRZA_DEFAULT,
    scheme: mode,
    followsAppScheme: true,
    palette: { ...ansi, background: surface.background, foreground: surface.foreground },
    canvasMix: surface.canvasMix,
    contrast
  })
}

function withCanvas({
  palette,
  canvasMix,
  contrast,
  ...rest
}: Pick<NativeChatTheme, 'themeName' | 'scheme' | 'followsAppScheme' | 'canvasMix'> & {
  palette: ITheme & Required<Pick<ITheme, 'background' | 'foreground'>>
  contrast: number
}): NativeChatTheme {
  const { background, foreground } = palette
  const light = rest.scheme === 'light'
  const canvas = mixCssColors(foreground, background, canvasMix) ?? background
  const foregroundMix = nativeChatContrastMix(contrast, light)
  return {
    ...rest,
    background,
    foreground,
    palette,
    canvas,
    canvasMix,
    foregroundMix,
    strongMix: Math.min(100, foregroundMix + (light ? 10 : 12)),
    text: mixCssColors(foreground, canvas, foregroundMix) ?? foreground
  }
}

/** The chat's own theme, from `nativeChatAppearance`, with its contrast. */
export function resolveNativeChatTheme(
  settings: NativeChatThemeContext & Partial<Pick<GlobalSettings, 'nativeChatAppearance'>>,
  systemPrefersDark: boolean
): NativeChatTheme {
  const appearance = resolveNativeChatAppearanceSettings(settings.nativeChatAppearance)
  return resolveNativeChatThemePair(appearance, settings, systemPrefersDark, appearance.contrast)
}
