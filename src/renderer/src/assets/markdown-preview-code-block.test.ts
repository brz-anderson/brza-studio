// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

// Why: happy-dom resolves the real cascade (specificity included) from the shipped
// stylesheet, so these catch a theme rule outranking the `pre code` reset. It has no
// layout, so the copy-button position is asserted through the margins that move it.
const SHEET_PATH = 'src/renderer/src/assets/markdown-preview.css'

beforeAll(() => {
  const style = document.createElement('style')
  style.textContent = readFileSync(SHEET_PATH, 'utf8')
  document.head.append(style)
})

afterEach(() => {
  document.body.innerHTML = ''
})

function find(selector: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(selector)
  if (!element) {
    throw new Error(`missing ${selector}`)
  }
  return element
}

function mount(theme: 'markdown-dark' | 'markdown-light', block: string): void {
  document.body.innerHTML = `<div class="${theme}"><div class="markdown-body">${block}</div></div>`
}

const FENCED = `<div class="code-block-wrapper"><pre><code>line</code></pre>
<button class="code-block-copy-btn"></button></div>`

describe.each(['markdown-dark', 'markdown-light'] as const)('%s code block', (theme) => {
  it('keeps the text of a fenced block free of the inline-code background', () => {
    mount(theme, FENCED)
    const code = find('pre code')
    expect(['', 'none', 'transparent', 'rgba(0, 0, 0, 0)']).toContain(
      getComputedStyle(code).backgroundColor
    )
  })

  it('keeps the inline-code background outside a block', () => {
    mount(theme, '<p><code>inline</code></p>')
    const code = find('p code')
    expect(getComputedStyle(code).backgroundColor).toMatch(/^rgba\(/)
    expect(getComputedStyle(code).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  })

  it('keeps the background and border of the pre itself', () => {
    mount(theme, FENCED)
    const pre = find('pre')
    expect(getComputedStyle(pre).backgroundColor).not.toBe('')
    expect(getComputedStyle(pre).borderTopStyle).toBe('solid')
  })

  it('puts the vertical margin on the wrapper so the copy button anchors to the pre', () => {
    mount(theme, FENCED)
    const pre = find('pre')
    const wrapper = find('.code-block-wrapper')
    expect(getComputedStyle(pre).marginTop).toBe('0px')
    expect(getComputedStyle(pre).marginBottom).toBe('0px')
    expect(getComputedStyle(wrapper).marginTop).toBe('16px')
    expect(getComputedStyle(wrapper).marginBottom).toBe('16px')
  })

  it('does not add margin around the diagram wrapper', () => {
    mount(
      theme,
      '<div class="code-block-wrapper code-block-wrapper-diagram"><svg></svg><button class="code-block-copy-btn"></button></div>'
    )
    const wrapper = find('.code-block-wrapper')
    expect(['', '0px']).toContain(getComputedStyle(wrapper).marginTop)
    expect(['', '0px']).toContain(getComputedStyle(wrapper).marginBottom)
  })
})
