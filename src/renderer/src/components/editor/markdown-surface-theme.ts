import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { resolveNativeChatAppearanceSettings } from '../../../../shared/native-chat-appearance-settings'
import {
  resolveMarkdownTheme,
  resolveMarkdownThemeSettings
} from '../../../../shared/markdown-theme-settings'
import { buildAppFontFamily } from '@/lib/app-font-family'
import { buildFontFamily } from '@/lib/monospace-font-family'
import {
  nativeChatThemeSurfaceStyle,
  type NativeChatThemeSurfaceStyle
} from '@/lib/native-chat-theme-surface-style'

const MARKDOWN_BASE_FONT_SIZE = 14

export type MarkdownSurfaceThemeSettings = Partial<
  Pick<
    GlobalSettings,
    | 'theme'
    | 'terminalCustomThemes'
    | 'terminalFontFamily'
    | 'nativeChatAppearance'
    | 'markdownTheme'
  >
>

export type MarkdownSurfaceTheme = {
  isDark: boolean
  /** Text size of the preview and rich editor before the editor zoom. */
  fontSize: number
  /** Root style of the preview and rich editor. */
  style: NativeChatThemeSurfaceStyle
  /** Code mode's canvas; absent when Monaco's global theme has the other scheme. */
  codeStyle: NativeChatThemeSurfaceStyle | undefined
  /** Code mode's font while following the chat; absent keeps the editor font. */
  codeFontFamily: string | undefined
}

export function selectMarkdownSurfaceThemeSettings(
  settings: Partial<GlobalSettings> | null | undefined
): MarkdownSurfaceThemeSettings {
  return {
    theme: settings?.theme,
    terminalCustomThemes: settings?.terminalCustomThemes,
    terminalFontFamily: settings?.terminalFontFamily,
    nativeChatAppearance: settings?.nativeChatAppearance,
    markdownTheme: settings?.markdownTheme
  }
}

/** The Markdown viewer's look (PLN-001 D47): the chat's theme and type, or its own theme. */
export function markdownSurfaceTheme(
  settings: MarkdownSurfaceThemeSettings,
  systemPrefersDark: boolean
): MarkdownSurfaceTheme {
  const theme = resolveMarkdownTheme(settings, systemPrefersDark)
  const isDark = theme.scheme === 'dark'
  const appTheme = settings.theme ?? 'system'
  const appIsDark = appTheme === 'system' ? systemPrefersDark : appTheme === 'dark'
  const style: NativeChatThemeSurfaceStyle = {
    ...nativeChatThemeSurfaceStyle(theme),
    backgroundColor: theme.canvas,
    '--editor-surface': theme.canvas
  }
  let fontSize = MARKDOWN_BASE_FONT_SIZE
  let codeFontFamily: string | undefined
  if (resolveMarkdownThemeSettings(settings.markdownTheme).followChat) {
    const appearance = resolveNativeChatAppearanceSettings(settings.nativeChatAppearance)
    fontSize = appearance.fontSize
    codeFontFamily = buildFontFamily(settings.terminalFontFamily ?? '')
    style['--font-mono'] = codeFontFamily
    if (appearance.fontFamily) {
      style.fontFamily = buildAppFontFamily(appearance.fontFamily)
    }
  }
  style['--markdown-font-size'] = `${fontSize}px`
  return {
    isDark,
    fontSize,
    style,
    codeStyle: isDark === appIsDark ? { '--markdown-code-canvas': theme.canvas } : undefined,
    codeFontFamily
  }
}
