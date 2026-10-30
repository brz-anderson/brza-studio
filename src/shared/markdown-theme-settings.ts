import type { GlobalSettings } from './global-settings-types'
import {
  NATIVE_CHAT_THEME_BRZA_DEFAULT,
  normalizeNativeChatThemePair
} from './native-chat-appearance-settings'
import {
  resolveNativeChatTheme,
  resolveNativeChatThemePair,
  type NativeChatTheme,
  type NativeChatThemeContext,
  type NativeChatThemePair
} from './native-chat-theme'

export type MarkdownThemeSettings = NativeChatThemePair & {
  /** Off gives the Markdown viewer its own theme pair and today's type; absent = on. */
  followChat?: boolean
}

export type MarkdownThemeGlobalSettings = {
  /** The Markdown viewer's theme (PLN-001 D47); absent follows the chat. */
  markdownTheme?: MarkdownThemeSettings
}

export function normalizeMarkdownThemeSettings(value: unknown): MarkdownThemeSettings | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  const normalized: MarkdownThemeSettings = {
    ...('followChat' in value && value.followChat === false ? { followChat: false } : {}),
    ...normalizeNativeChatThemePair(value)
  }
  return Object.keys(normalized).length ? normalized : undefined
}

export function resolveMarkdownThemeSettings(value: unknown): Required<MarkdownThemeSettings> {
  const normalized = normalizeMarkdownThemeSettings(value)
  return {
    followChat: normalized?.followChat ?? true,
    themeDark: normalized?.themeDark ?? NATIVE_CHAT_THEME_BRZA_DEFAULT,
    useSeparateLightTheme: normalized?.useSeparateLightTheme ?? false,
    themeLight: normalized?.themeLight ?? NATIVE_CHAT_THEME_BRZA_DEFAULT
  }
}

/** The chat's theme while the viewer follows it, else the viewer's own pair at default contrast. */
export function resolveMarkdownTheme(
  settings: NativeChatThemeContext &
    Partial<Pick<GlobalSettings, 'nativeChatAppearance' | 'markdownTheme'>>,
  systemPrefersDark: boolean
): NativeChatTheme {
  const markdown = resolveMarkdownThemeSettings(settings.markdownTheme)
  return markdown.followChat
    ? resolveNativeChatTheme(settings, systemPrefersDark)
    : resolveNativeChatThemePair(markdown, settings, systemPrefersDark)
}
