import type { ITheme } from '@xterm/xterm'
import type { GlobalSettings } from './global-settings-types'
import { resolveNativeChatTheme, type NativeChatThemeContext } from './native-chat-theme'
import {
  terminalColorOverridesForSlot,
  withTerminalColorOverrides,
  type TerminalColorOverrideSettings
} from './terminal-themes/terminal-color-overrides'
import type { TerminalOscColorQueryReplyColors } from './terminal/protocol/queries/terminal-osc-color-reply'
import {
  resolveConfiguredTerminalColors,
  type TerminalPaletteSettings
} from './terminal-themes/terminal-theme-selection'

export type TerminalChatThemeSettings = NativeChatThemeContext &
  Partial<
    Pick<
      GlobalSettings,
      'nativeChatAppearance' | 'terminalFollowsChatTheme' | 'terminalUseSeparateLightTheme'
    > &
      TerminalColorOverrideSettings
  >

export type TerminalChatTheme = {
  mode: 'dark' | 'light'
  themeName: string
  theme: ITheme
}

export function terminalFollowsChatTheme(
  settings: Pick<TerminalChatThemeSettings, 'terminalFollowsChatTheme'>
): boolean {
  return settings.terminalFollowsChatTheme !== false
}

/** The chat's ANSI palette on the chat canvas, with the color overrides of the slot the app's mode paints
 *  (PLN-001 D46: the overrides still apply on top); null while the terminal keeps its own theme. */
export function resolveTerminalChatTheme(
  settings: TerminalChatThemeSettings,
  systemPrefersDark: boolean
): TerminalChatTheme | null {
  if (!terminalFollowsChatTheme(settings)) {
    return null
  }
  const chat = resolveNativeChatTheme(settings, systemPrefersDark)
  // The slot the app's mode picks, as selectTerminalTheme does (the chat's own scheme may differ from it),
  // so the overrides are the ones the settings page edits for this mode.
  const appMode = settings.theme ?? 'dark'
  const light = appMode === 'system' ? !systemPrefersDark : appMode === 'light'
  const slot = light && settings.terminalUseSeparateLightTheme ? 'light' : 'dark'
  return {
    mode: chat.scheme,
    themeName: chat.themeName,
    theme: withTerminalColorOverrides(
      { ...chat.palette, background: chat.canvas },
      terminalColorOverridesForSlot(settings, slot)
    )
  }
}

/** Saved-settings OSC 10/11 colors that follow the chat the way the rendered terminal does. */
export function resolveSavedTerminalColors(
  settings: TerminalPaletteSettings & TerminalChatThemeSettings,
  systemPrefersDark: boolean
): TerminalOscColorQueryReplyColors {
  const chat = resolveTerminalChatTheme(settings, systemPrefersDark)
  if (!chat) {
    return resolveConfiguredTerminalColors(settings, systemPrefersDark)
  }
  const { foreground, background } = chat.theme
  return { ...(foreground ? { foreground } : {}), ...(background ? { background } : {}) }
}
