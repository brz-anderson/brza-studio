// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/orca-profiles/constants'
import { useAppStore } from '../../store'

const mocks = vi.hoisted(() => ({
  applyDocumentTheme: vi.fn(),
  applyPluginAppTheme: vi.fn(),
  buildAppFontFamily: vi.fn((fontFamily: string | null | undefined) => fontFamily ?? '')
}))

vi.mock('../appearance/document-theme', () => ({
  applyDocumentTheme: mocks.applyDocumentTheme,
  applyPluginAppTheme: mocks.applyPluginAppTheme,
  readCachedPluginAppTheme: () => null
}))

vi.mock('@/app-shell/appearance/app-font-family', () => ({
  buildAppFontFamily: mocks.buildAppFontFamily
}))

// Why: the hook reads window.api.ui for the plugin video theme, which this test has no preload for.
vi.mock('../../lib/window-activity/use-window-active', () => ({ useWindowActive: () => true }))

vi.mock('../../runtime/sync-runtime-graph/graph-sync-scheduler', () => ({
  scheduleRuntimeGraphSync: vi.fn()
}))

import { useDocumentAppearance } from '../appearance/use-document-appearance'

const initialState = useAppStore.getState()

describe('useDocumentAppearance while the terminal follows the chat theme', () => {
  beforeEach(() => {
    mocks.applyDocumentTheme.mockReset()
  })

  afterEach(() => {
    useAppStore.setState(initialState, true)
  })

  it('paints the mode of the chat theme that Match Terminal follows', () => {
    useAppStore.setState({
      settings: {
        ...getDefaultSettings('/tmp'),
        theme: 'dark',
        terminalFollowsChatTheme: true,
        terminalThemeDark: 'Solarized Light',
        nativeChatAppearance: { themeDark: 'Ghostty Default Style Dark' },
        pluginAppThemeDark: 'match-terminal'
      }
    })
    const { unmount } = renderHook(() => useDocumentAppearance())
    expect(mocks.applyDocumentTheme).toHaveBeenLastCalledWith('dark')
    unmount()
  })
})
