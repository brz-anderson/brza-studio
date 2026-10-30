import type { ITheme } from '@xterm/xterm'
import type { GlobalSettings } from './global-settings-types'
import { resolveNativeChatTheme, type NativeChatThemeContext } from './native-chat-theme'
import type { TerminalOscColorQueryReplyColors } from './terminal-osc-color-reply'
import {
  resolveConfiguredTerminalColors,
  type TerminalThemeSelectionSettings
} from './terminal-theme-selection'

export type TerminalChatThemeSettings = NativeChatThemeContext &
  Partial<Pick<GlobalSettings, 'nativeChatAppearance' | 'terminalFollowsChatTheme'>>

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

/** The chat's ANSI palette on the chat canvas (PLN-001 D46); null while the terminal keeps its own theme. */
export function resolveTerminalChatTheme(
  settings: TerminalChatThemeSettings,
  systemPrefersDark: boolean
): TerminalChatTheme | null {
  if (!terminalFollowsChatTheme(settings)) {
    return null
  }
  const chat = resolveNativeChatTheme(settings, systemPrefersDark)
  return {
    mode: chat.scheme,
    themeName: chat.themeName,
    theme: { ...chat.palette, background: chat.canvas }
  }
}

/** Saved-settings OSC 10/11 colors that follow the chat the way the rendered terminal does. */
export function resolveSavedTerminalColors(
  settings: TerminalThemeSelectionSettings &
    Pick<GlobalSettings, 'terminalCustomThemes' | 'terminalColorOverrides'> &
    TerminalChatThemeSettings,
  systemPrefersDark: boolean
): TerminalOscColorQueryReplyColors {
  const chat = resolveTerminalChatTheme(settings, systemPrefersDark)
  if (!chat) {
    return resolveConfiguredTerminalColors(settings, systemPrefersDark)
  }
  const foreground = settings.terminalColorOverrides?.foreground ?? chat.theme.foreground
  const background = settings.terminalColorOverrides?.background ?? chat.theme.background
  return { ...(foreground ? { foreground } : {}), ...(background ? { background } : {}) }
}
