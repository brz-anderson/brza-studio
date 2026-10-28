// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { NativeChatToolRunIcon } from '../NativeChatToolIcon'

afterEach(cleanup)

function drawnGlyph(iconName: Parameters<typeof NativeChatToolRunIcon>[0]['iconName']) {
  const svg = render(<NativeChatToolRunIcon iconName={iconName} />).container.querySelector('svg')
  return { viewBox: svg?.getAttribute('viewBox'), lucide: svg?.classList.contains('lucide') }
}

describe('BrzA glyphs in the desktop tool slot', () => {
  it('draws brand logos instead of their lucide fallbacks', () => {
    expect(drawnGlyph('git-logo')).toEqual({ viewBox: '0 0 24 24', lucide: false })
    expect(drawnGlyph('github-logo')).toEqual({ viewBox: '0 0 16 16', lucide: false })
    expect(drawnGlyph('jira-logo').lucide).toBe(false)
  })

  it('draws the lucide glyphs the BrzA categories name', () => {
    expect(drawnGlyph('git-branch').lucide).toBe(true)
    expect(drawnGlyph('pen-tool').lucide).toBe(true)
  })
})
