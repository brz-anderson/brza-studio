// @vitest-environment happy-dom
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createGlobalSettingsFixture } from '../../../../shared/global-settings-test-fixture'
import { MarkdownThemeSetting } from './MarkdownThemeSetting'

const mock = vi.hoisted(() => ({ state: { settingsSearchQuery: '' } }))

vi.mock('../../store', () => ({
  useAppStore: Object.assign(
    (selector: (state: typeof mock.state) => unknown) => selector(mock.state),
    { getState: () => mock.state }
  )
}))
afterEach(cleanup)

describe('MarkdownThemeSetting', () => {
  it('keeps its own theme picker inert until the viewer stops following the chat', () => {
    const updateSettings = vi.fn<(updates: Partial<GlobalSettings>) => void>()
    const following = createGlobalSettingsFixture({ theme: 'dark' })
    const { rerender } = render(
      <MarkdownThemeSetting settings={following} updateSettings={updateSettings} />
    )
    const picker = screen.getByRole('combobox', { name: 'Dark theme' })
    expect(picker.closest('[aria-disabled="true"]')).not.toBeNull()
    fireEvent.click(screen.getByRole('switch', { name: 'Markdown Follows the Chat' }))
    expect(updateSettings).toHaveBeenLastCalledWith({ markdownTheme: { followChat: false } })

    const own = createGlobalSettingsFixture({ theme: 'dark', markdownTheme: { followChat: false } })
    rerender(<MarkdownThemeSetting settings={own} updateSettings={updateSettings} />)
    expect(
      screen.getByRole('combobox', { name: 'Dark theme' }).closest('[aria-disabled="true"]')
    ).toBeNull()
    fireEvent.click(screen.getByRole('combobox', { name: 'Dark theme' }))
    fireEvent.change(screen.getByPlaceholderText('Search terminal themes'), {
      target: { value: 'Tango Dark' }
    })
    fireEvent.click(screen.getByRole('option', { name: 'Tango Dark' }))
    expect(updateSettings).toHaveBeenLastCalledWith({
      markdownTheme: { followChat: false, themeDark: 'Tango Dark' }
    })
  })
})
