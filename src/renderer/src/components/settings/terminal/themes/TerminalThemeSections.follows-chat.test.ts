import type * as ReactModule from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { GlobalSettings } from '../../../../../../shared/global-settings-types'
import type { UseWarpThemeImportReturn } from './useWarpThemeImport'

// Why: the section runs as a plain function, so every state hook reports the light target.
vi.mock('@/store/plugins/appearance/plugin-themes', () => ({
  usePluginTerminalThemes: () => [],
  usePluginTerminalThemeStore: { getState: () => ({ entries: [] }) }
}))

// Why: with no renderer, the context hook behind useTranslate has no dispatcher.
vi.mock('@/i18n/use-translate', async () => {
  const { translate } = await import('@/i18n/i18n')
  return { useTranslate: () => translate }
})

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof ReactModule>('react')
  return { ...actual, useState: (_initial: unknown) => ['light', () => {}] }
})

vi.mock('../appearance/TerminalSettingsPreview', () => ({
  TerminalSettingsPreview: function TerminalSettingsPreview() {
    return null
  }
}))

import { TerminalThemeCatalogSection } from './TerminalThemeSections'

type ReactElementLike = { type: unknown; props?: Record<string, unknown> }

const warpThemes: UseWarpThemeImportReturn = {
  open: false,
  mode: 'warp',
  preview: null,
  loading: false,
  desktopOnly: false,
  applyError: null,
  importSignal: 0,
  selectedThemeIds: new Set<string>(),
  handleClick: vi.fn(),
  handleImportYamlClick: vi.fn(),
  handlePreviewSource: vi.fn(),
  handleToggleTheme: vi.fn(),
  handleToggleAll: vi.fn(),
  handleApply: vi.fn(),
  handleOpenChange: vi.fn()
}

function typeName(node: ReactElementLike): string {
  return typeof node.type === 'function' ? node.type.name : String(node.type)
}

function findElement(
  node: unknown,
  matches: (element: ReactElementLike) => boolean
): ReactElementLike | null {
  if (node == null || typeof node === 'string' || typeof node === 'number') {
    return null
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElement(child, matches)
      if (found) {
        return found
      }
    }
    return null
  }
  const element = node as ReactElementLike
  return matches(element) ? element : findElement(element.props?.children, matches)
}

function findSwitchByLabel(node: unknown, label: string): ReactElementLike | null {
  return findElement(
    node,
    (element) => typeName(element) === 'SettingsSwitchRow' && element.props?.label === label
  )
}

describe('TerminalThemeCatalogSection while the terminal follows the chat', () => {
  it('locks the terminal theme controls and lets the follow switch turn it off', () => {
    const updateSettings = vi.fn()
    const element = TerminalThemeCatalogSection({
      settings: {
        theme: 'system',
        terminalUseSeparateLightTheme: false,
        terminalThemeDark: 'Ghostty Default Style Dark',
        terminalThemeLight: 'Builtin Tango Light',
        terminalDividerColorDark: '#3f3f46',
        terminalDividerColorLight: '#d4d4d8',
        terminalCustomThemes: []
      } as unknown as GlobalSettings,
      systemPrefersDark: true,
      updateSettings,
      previewFontFamily: null,
      importedHighlightSignal: 7,
      warpThemes,
      showThemeImport: true
    })
    const followChatSwitch = findSwitchByLabel(element, 'Follow chat theme')

    expect(followChatSwitch?.props?.checked).toBe(true)
    expect(findSwitchByLabel(element, 'Match dark mode')?.props?.disabled).toBe(true)
    expect(
      findElement(
        element,
        (candidate) =>
          typeof candidate.props?.className === 'string' &&
          candidate.props.className.includes('opacity-50')
      )?.props?.inert
    ).toBe(true)

    const toggleFollowChat = followChatSwitch?.props?.onChange
    expect(toggleFollowChat).toBeTypeOf('function')
    if (typeof toggleFollowChat === 'function') {
      toggleFollowChat()
    }
    expect(updateSettings).toHaveBeenCalledWith({ terminalFollowsChatTheme: false })
  })
})
