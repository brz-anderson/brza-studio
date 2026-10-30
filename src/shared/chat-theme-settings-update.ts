import type { GlobalSettings } from './global-settings-types'
import { normalizeMarkdownThemeSettings } from './markdown-theme-settings'
import { normalizeNativeChatAppearanceSettings } from './native-chat-appearance-settings'

/** Normalizes the chat appearance and the Markdown theme an update carries, in place. */
export function sanitizeChatThemeSettingsUpdate(
  sanitized: Partial<GlobalSettings>,
  updates: Partial<GlobalSettings>
): void {
  if ('nativeChatAppearance' in updates) {
    sanitized.nativeChatAppearance = normalizeNativeChatAppearanceSettings(
      updates.nativeChatAppearance
    )
  }
  if ('markdownTheme' in updates) {
    sanitized.markdownTheme = normalizeMarkdownThemeSettings(updates.markdownTheme)
  }
}
