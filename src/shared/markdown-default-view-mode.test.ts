import { describe, expect, it } from 'vitest'
import { getDefaultSettings } from './constants'
import {
  DEFAULT_MARKDOWN_DEFAULT_VIEW_MODE,
  normalizeMarkdownDefaultViewMode
} from './markdown-default-view-mode'

describe('markdown default view mode in BrzA Studio', () => {
  it('opens Markdown in the read-only preview by default', () => {
    expect(DEFAULT_MARKDOWN_DEFAULT_VIEW_MODE).toBe('preview')
    expect(normalizeMarkdownDefaultViewMode(undefined)).toBe('preview')
    expect(normalizeMarkdownDefaultViewMode('bogus')).toBe('preview')
  })

  it.each(['preview', 'rich', 'source'] as const)('keeps the chosen %s view', (mode) => {
    expect(normalizeMarkdownDefaultViewMode(mode)).toBe(mode)
  })

  it('ships preview in the default settings', () => {
    expect(getDefaultSettings('/home/u').markdownDefaultViewMode).toBe('preview')
  })
})
