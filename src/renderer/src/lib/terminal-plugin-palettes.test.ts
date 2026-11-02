import { describe, expect, it } from 'vitest'
import type { PluginTerminalThemeRegistration } from '../../../shared/plugins/artifacts/plugin-terminal-theme-artifact'
import {
  refreshedTerminalPluginPalettes,
  withTerminalPluginPalettes
} from './terminal-plugin-palettes'

const dawn: PluginTerminalThemeRegistration = {
  id: 'plugin:samples.dawn/dawn',
  pluginKey: 'samples.dawn',
  pluginName: 'Dawn',
  label: 'Dawn',
  mode: 'light',
  terminal: { background: '#fdf6e3', foreground: '#586e75' }
}
const base = { terminalThemeDark: 'Builtin Tango Dark', terminalThemeLight: '' }

describe('withTerminalPluginPalettes', () => {
  it('leaves a write alone when no plugin theme is selected anywhere', () => {
    const update = { terminalThemeDark: 'Dracula' }
    expect(withTerminalPluginPalettes(base, update, [dawn])).toBe(update)
  })

  it('snapshots a plugin theme the chat or the Markdown viewer selected', () => {
    const chat = withTerminalPluginPalettes(
      base,
      { nativeChatAppearance: { themeDark: dawn.id } },
      [dawn]
    )
    expect(chat.terminalPluginPalettes).toEqual([{ id: dawn.id, colors: dawn.terminal }])
    const markdown = withTerminalPluginPalettes(
      { ...base, markdownTheme: { themeLight: dawn.id } },
      {},
      [dawn]
    )
    expect(markdown.terminalPluginPalettes).toEqual([{ id: dawn.id, colors: dawn.terminal }])
  })

  it('keeps the saved palette while the plugin is gone, and refreshes it when the plugin updates', () => {
    const saved = [{ id: dawn.id, colors: { background: '#000000', foreground: '#ffffff' } }]
    const settings = {
      ...base,
      nativeChatAppearance: { themeDark: dawn.id },
      terminalPluginPalettes: saved
    }
    expect(refreshedTerminalPluginPalettes(settings, [])).toBeNull()
    expect(refreshedTerminalPluginPalettes(settings, [dawn])?.terminalPluginPalettes).toEqual([
      { id: dawn.id, colors: dawn.terminal }
    ])
  })
})
