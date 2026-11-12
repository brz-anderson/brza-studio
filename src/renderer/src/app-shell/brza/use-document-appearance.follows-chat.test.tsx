// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import { useAppStore } from '../../store'
import { resetSystemPrefersDarkSubscriptionForTests } from '@/hooks/theme/use-system-prefers-dark'

const mocks = vi.hoisted(() => ({
  applyDocumentTheme: vi.fn(),
  applyPluginAppTheme: vi.fn(),
  buildAppFontFamily: vi.fn((fontFamily: string | null | undefined) => fontFamily ?? '')
}))

vi.mock('../../lib/document-theme', () => ({
  applyDocumentTheme: mocks.applyDocumentTheme,
  applyPluginAppTheme: mocks.applyPluginAppTheme,
  readCachedPluginAppTheme: () => null
}))

vi.mock('@/lib/app-font-family', () => ({
  buildAppFontFamily: mocks.buildAppFontFamily
}))

// Why: the hook reads window.api.ui for the plugin video theme, which this test has no preload for.
vi.mock('../../hooks/use-window-active', () => ({ useWindowActive: () => true }))

vi.mock('../../runtime/sync-runtime-graph', () => ({
  scheduleRuntimeGraphSync: vi.fn()
}))

import { useDocumentAppearance } from '../use-document-appearance'

const initialState = useAppStore.getState()

describe('useDocumentAppearance while the terminal follows the chat theme', () => {
  beforeEach(() => {
    mocks.applyDocumentTheme.mockReset()
    resetSystemPrefersDarkSubscriptionForTests()
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
