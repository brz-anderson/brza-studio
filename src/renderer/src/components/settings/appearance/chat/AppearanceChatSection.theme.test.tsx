// @vitest-environment happy-dom
import type { GlobalSettings } from '../../../../../../shared/global-settings-types'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createGlobalSettingsFixture } from '../../../../../../shared/global-settings-test-fixture'
import { AppearanceChatSection } from './AppearanceChatSection'

const mock = vi.hoisted(
  (): { state: { settingsSearchQuery: string; settings: GlobalSettings | null } } => ({
    state: { settingsSearchQuery: '', settings: null }
  })
)

vi.mock('../../../../store', () => ({
  useAppStore: Object.assign(
    (selector: (state: typeof mock.state) => unknown) => selector(mock.state),
    { getState: () => mock.state }
  )
}))
beforeEach(() => {
  mock.state.settings = null
})
afterEach(cleanup)

describe('chat theme setting', () => {
  it('saves a catalog theme picked for the dark mode', async () => {
    const settings = createGlobalSettingsFixture({ theme: 'dark' })
    mock.state.settings = settings
    const updateSettings = vi.fn(async (updates: Partial<GlobalSettings>) => {
      mock.state.settings = { ...mock.state.settings!, ...updates }
    })
    render(<AppearanceChatSection settings={settings} updateSettings={updateSettings} />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Dark theme' }))
    fireEvent.change(screen.getByPlaceholderText('Search terminal themes'), {
      target: { value: 'Tango Dark' }
    })
    fireEvent.click(screen.getByRole('option', { name: 'Tango Dark' }))
    await waitFor(() =>
      expect(updateSettings).toHaveBeenCalledWith({
        nativeChatAppearance: { themeDark: 'Tango Dark' }
      })
    )
  })
})
