import { describe, expect, it } from 'vitest'
import { getDefaultMarkdownViewMode, getMarkdownViewModes } from './markdown-preview-controls'

describe('Markdown view modes in BrzA Studio', () => {
  it('offers preview, rich and source for Markdown edit tabs', () => {
    expect(getMarkdownViewModes({ language: 'markdown', mode: 'edit' })).toEqual([
      'preview',
      'rich',
      'source'
    ])
  })

  it('opens a Markdown edit tab in preview unless the setting says otherwise', () => {
    const target = { language: 'markdown', mode: 'edit' } as const
    expect(getDefaultMarkdownViewMode(target)).toBe('preview')
    expect(getDefaultMarkdownViewMode(target, 'preview')).toBe('preview')
    expect(getDefaultMarkdownViewMode(target, 'rich')).toBe('rich')
    expect(getDefaultMarkdownViewMode(target, 'source')).toBe('source')
  })

  it('keeps Markdown diffs on source whatever the setting says', () => {
    expect(getDefaultMarkdownViewMode({ language: 'markdown', mode: 'diff' }, 'preview')).toBe(
      'source'
    )
  })
})
