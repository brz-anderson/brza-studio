import type { GlobalSettings } from '../../../shared/global-settings-types'
import type { TerminalPluginPalette } from '../../../shared/terminal-themes/terminal-color-overrides'
import type { PluginTerminalThemeRegistration } from '../../../shared/plugins/artifacts/plugin-terminal-theme-artifact'

type PaletteSettings = Pick<
  GlobalSettings,
  'terminalThemeDark' | 'terminalThemeLight' | 'terminalPluginPalettes'
> &
  Partial<Pick<GlobalSettings, 'nativeChatAppearance' | 'markdownTheme'>>

/** The terminal's pair, and the chat's and Markdown viewer's, since all three pick from one catalog. */
function selectedThemeNames(settings: PaletteSettings, update: Partial<GlobalSettings>): string[] {
  const chat = update.nativeChatAppearance ?? settings.nativeChatAppearance
  const markdown = update.markdownTheme ?? settings.markdownTheme
  return [
    update.terminalThemeDark ?? settings.terminalThemeDark,
    update.terminalThemeLight ?? settings.terminalThemeLight,
    chat?.themeDark,
    chat?.themeLight,
    markdown?.themeDark,
    markdown?.themeLight
  ].filter((name): name is string => typeof name === 'string')
}

function selectedPalettes(
  selections: readonly string[],
  current: readonly TerminalPluginPalette[],
  pluginThemes: readonly PluginTerminalThemeRegistration[]
): TerminalPluginPalette[] {
  return [...new Set(selections)].flatMap((selection) => {
    const theme = pluginThemes.find((candidate) => candidate.id === selection)
    // Why keep the old snapshot: re-enabling a disabled plugin restores the palette it chose.
    const palette = theme
      ? { id: theme.id, colors: theme.terminal }
      : current.find((entry) => entry.id === selection)
    return palette ? [palette] : []
  })
}

/** Adds the palette snapshot a terminal, chat or Markdown theme selection needs, so every host resolves it. */
export function withTerminalPluginPalettes(
  settings: PaletteSettings,
  update: Partial<GlobalSettings>,
  pluginThemes: readonly PluginTerminalThemeRegistration[]
): Partial<GlobalSettings> {
  const current = settings.terminalPluginPalettes ?? []
  const selections = selectedThemeNames(settings, update)
  // Why: users who never pick a plugin theme keep their settings writes unchanged.
  if (current.length === 0 && !selections.some((name) => name.startsWith('plugin:'))) {
    return update
  }
  return { ...update, terminalPluginPalettes: selectedPalettes(selections, current, pluginThemes) }
}

/** The snapshot refresh after a plugin updates a selected palette, or null when nothing changed. */
export function refreshedTerminalPluginPalettes(
  settings: PaletteSettings,
  pluginThemes: readonly PluginTerminalThemeRegistration[]
): Partial<GlobalSettings> | null {
  const next = withTerminalPluginPalettes(settings, {}, pluginThemes)
  return !next.terminalPluginPalettes ||
    JSON.stringify(next.terminalPluginPalettes) ===
      JSON.stringify(settings.terminalPluginPalettes ?? [])
    ? null
    : next
}
