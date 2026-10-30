import type { GlobalSettings } from './global-settings-types'
import {
  DEFAULT_TERMINAL_THEME_DARK,
  DEFAULT_TERMINAL_THEME_LIGHT
} from './terminal-theme-selection'
import type { TuiAgent } from './tui-agent'

export type NativeChatAppearanceSettings = {
  /** Absent follows the IDE font. */
  fontFamily?: string
  /** Chat text size in px, 12–20; absent = 14. */
  fontSize?: number
  /** Code text size in px, 10–18; absent = 12. */
  codeFontSize?: number
  /** Transcript and composer width; absent = comfortable (46rem). */
  width?: 'comfortable' | 'wide' | 'full'
  /** Chat contrast, 50–150; absent = 100. */
  contrast?: number
  /** Chat theme in dark mode, and in light mode without a separate light theme: a terminal theme
   *  name, a `custom:` selection, or the BrzA default; absent = BrzA default. */
  themeDark?: string
  /** Use `themeLight` while the app is light; absent = false. */
  useSeparateLightTheme?: boolean
  /** Chat theme in light mode when `useSeparateLightTheme` is on; absent = BrzA default. */
  themeLight?: string
}

/** The chat's look before it had a theme: the app background and the default terminal colors. */
export const NATIVE_CHAT_THEME_BRZA_DEFAULT = 'brza:default'

export type NativeChatGlobalSettings = {
  nativeChatAppearance?: NativeChatAppearanceSettings
  /** Off keeps chats unnamed without running a naming agent. Absent means on. */
  nativeChatAutoName?: boolean
  /** Explicit chat provider choices; unlisted agents retain the chat launch default. */
  nativeChatProviders?: Partial<Record<TuiAgent, boolean>>
  /** The chat composer shows its Markdown formatted; what it sends stays Markdown. Absent = off. */
  nativeChatMarkdownComposer?: boolean
}

export const DEFAULT_NATIVE_CHAT_FONT_SIZE = 14
export const DEFAULT_NATIVE_CHAT_CODE_FONT_SIZE = 12
export const DEFAULT_NATIVE_CHAT_CONTRAST = 100

const NATIVE_CHAT_APPEARANCE_KEYS = [
  'fontFamily',
  'fontSize',
  'codeFontSize',
  'width',
  'contrast',
  'themeDark',
  'useSeparateLightTheme',
  'themeLight',
  // Retired by the chat theme; migrated on load.
  'matchTerminalInterface'
]

function normalizeThemeName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : ''
  return name === NATIVE_CHAT_THEME_BRZA_DEFAULT ? '' : name
}

type StoredThemePair = {
  themeDark?: unknown
  useSeparateLightTheme?: unknown
  themeLight?: unknown
}

/** The theme pair fields of a stored record, with the BrzA default and `false` left out. */
export function normalizeNativeChatThemePair(
  stored: StoredThemePair
): Pick<NativeChatAppearanceSettings, 'themeDark' | 'useSeparateLightTheme' | 'themeLight'> {
  const themeDark = normalizeThemeName(stored.themeDark)
  const themeLight = normalizeThemeName(stored.themeLight)
  const useSeparateLightTheme = stored.useSeparateLightTheme === true
  return {
    ...(themeDark ? { themeDark } : {}),
    ...(useSeparateLightTheme ? { useSeparateLightTheme } : {}),
    ...(themeLight ? { themeLight } : {})
  }
}

function normalizeSize(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback
}

export function normalizeNativeChatAppearanceSettings(
  value: unknown
): NativeChatAppearanceSettings | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const fontFamily =
    'fontFamily' in value && typeof value.fontFamily === 'string' ? value.fontFamily.trim() : ''
  const fontSize = normalizeSize('fontSize' in value ? value.fontSize : undefined, 12, 20, 14)
  const codeFontSize = normalizeSize(
    'codeFontSize' in value ? value.codeFontSize : undefined,
    10,
    18,
    12
  )
  const contrast = normalizeSize('contrast' in value ? value.contrast : undefined, 50, 150, 100)
  const width =
    'width' in value && (value.width === 'wide' || value.width === 'full') ? value.width : undefined
  const normalized: NativeChatAppearanceSettings = {
    ...Object.fromEntries(
      Object.entries(value).filter(([key]) => !NATIVE_CHAT_APPEARANCE_KEYS.includes(key))
    ),
    ...(fontFamily ? { fontFamily } : {}),
    ...(fontSize !== DEFAULT_NATIVE_CHAT_FONT_SIZE ? { fontSize } : {}),
    ...(codeFontSize !== DEFAULT_NATIVE_CHAT_CODE_FONT_SIZE ? { codeFontSize } : {}),
    ...(width ? { width } : {}),
    ...(contrast !== DEFAULT_NATIVE_CHAT_CONTRAST ? { contrast } : {}),
    ...normalizeNativeChatThemePair(value)
  }
  return Object.keys(normalized).length ? normalized : undefined
}

export function resolveNativeChatAppearanceSettings(
  value: unknown
): Required<NativeChatAppearanceSettings> {
  const normalized = normalizeNativeChatAppearanceSettings(value)
  return {
    fontFamily: normalized?.fontFamily ?? '',
    fontSize: normalized?.fontSize ?? DEFAULT_NATIVE_CHAT_FONT_SIZE,
    codeFontSize: normalized?.codeFontSize ?? DEFAULT_NATIVE_CHAT_CODE_FONT_SIZE,
    width: normalized?.width ?? 'comfortable',
    contrast: normalized?.contrast ?? DEFAULT_NATIVE_CHAT_CONTRAST,
    themeDark: normalized?.themeDark ?? NATIVE_CHAT_THEME_BRZA_DEFAULT,
    useSeparateLightTheme: normalized?.useSeparateLightTheme ?? false,
    themeLight: normalized?.themeLight ?? NATIVE_CHAT_THEME_BRZA_DEFAULT
  }
}

export function resetNativeChatAppearanceSettings(
  appearance: NativeChatAppearanceSettings | undefined
): NativeChatAppearanceSettings | undefined {
  return normalizeNativeChatAppearanceSettings(
    Object.fromEntries(
      Object.entries(appearance ?? {}).filter(([key]) => !NATIVE_CHAT_APPEARANCE_KEYS.includes(key))
    )
  )
}

type RetiredMatchTerminalSource = Partial<
  Pick<
    GlobalSettings,
    | 'nativeChatAppearance'
    | 'terminalThemeDark'
    | 'terminalUseSeparateLightTheme'
    | 'terminalThemeLight'
    | 'terminalFontFamily'
    | 'terminalFontSize'
  >
>

/** The retired "match terminal interface" becomes the terminal's theme pair, font and size as the chat's own. */
export function migrateNativeChatAppearanceSettings(
  settings: RetiredMatchTerminalSource | undefined
): NativeChatAppearanceSettings | undefined {
  const appearance: unknown = settings?.nativeChatAppearance
  const matching =
    !!appearance &&
    typeof appearance === 'object' &&
    'matchTerminalInterface' in appearance &&
    appearance.matchTerminalInterface === true
  if (!matching) {
    return normalizeNativeChatAppearanceSettings(appearance)
  }
  const terminalFontFamily = settings?.terminalFontFamily?.trim()
  return normalizeNativeChatAppearanceSettings({
    ...appearance,
    themeDark: settings?.terminalThemeDark || DEFAULT_TERMINAL_THEME_DARK,
    useSeparateLightTheme: settings?.terminalUseSeparateLightTheme === true,
    themeLight: settings?.terminalThemeLight || DEFAULT_TERMINAL_THEME_LIGHT,
    ...(terminalFontFamily ? { fontFamily: terminalFontFamily } : {}),
    fontSize: settings?.terminalFontSize,
    codeFontSize: settings?.terminalFontSize,
    contrast: undefined
  })
}
