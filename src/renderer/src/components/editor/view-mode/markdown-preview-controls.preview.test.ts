import { describe, expect, it } from 'vitest'
import { getMarkdownViewModes } from './markdown-preview-controls'

describe('Markdown view modes in BrzA Studio', () => {
  it('offers preview, rich and source for Markdown edit tabs', () => {
    expect(getMarkdownViewModes({ language: 'markdown', mode: 'edit' })).toEqual([
      'preview',
      'rich',
      'source'
    ])
  })
})
