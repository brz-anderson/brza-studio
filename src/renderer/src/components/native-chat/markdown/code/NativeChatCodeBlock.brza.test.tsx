// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NativeChatCodeBlock } from './NativeChatCodeBlock'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('NativeChatCodeBlock', () => {
  it.each([
    ['with a language header', 'typescript'],
    ['without a language header', undefined]
  ])('wraps long lines until the reader turns wrapping off (%s)', (_name, language) => {
    const { container } = render(
      <NativeChatCodeBlock language={language}>
        <code>{'const longLine = 1\n'}</code>
      </NativeChatCodeBlock>
    )
    const pre = container.querySelector('pre')

    const wrapOff = screen.getByRole('button', { name: 'Disable line wrap' })
    expect(wrapOff).toHaveAttribute('aria-pressed', 'true')
    expect(pre).toHaveClass('whitespace-pre-wrap', '[overflow-wrap:anywhere]')
    expect(pre).not.toHaveClass('overflow-x-auto')

    fireEvent.click(wrapOff)

    const wrapOn = screen.getByRole('button', { name: 'Wrap lines' })
    expect(wrapOn).toHaveAttribute('aria-pressed', 'false')
    expect(pre).toHaveClass('overflow-x-auto')
    expect(pre).not.toHaveClass('whitespace-pre-wrap')

    fireEvent.click(wrapOn)

    expect(screen.getByRole('button', { name: 'Disable line wrap' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(pre).toHaveClass('whitespace-pre-wrap')
  })

  it.each([
    ['\n', 'one\n\n  two  \n\n', 'one\n\n  two  \n'],
    ['\r\n', 'one\r\n  two  \r\n', 'one\r\n  two  ']
  ])('copies without only the fence closing %j', async (_ending, code, copied) => {
    const writeClipboardText = vi.fn().mockResolvedValue(undefined)
    Object.assign(window, { api: { ui: { writeClipboardText } } })
    render(
      <NativeChatCodeBlock>
        <code>{code}</code>
      </NativeChatCodeBlock>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy code' }))

    await waitFor(() => expect(writeClipboardText).toHaveBeenCalledWith(copied))
  })

  it('keeps wrapping to the block the reader toggled', () => {
    render(
      <>
        <NativeChatCodeBlock language="typescript">
          <code>{'first\n'}</code>
        </NativeChatCodeBlock>
        <NativeChatCodeBlock language="typescript">
          <code>{'second\n'}</code>
        </NativeChatCodeBlock>
      </>
    )

    fireEvent.click(screen.getAllByRole('button', { name: 'Disable line wrap' })[0])

    expect(screen.getByRole('button', { name: 'Wrap lines' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Disable line wrap' })).toHaveLength(1)
  })

  it('shows no wrap control for an empty block', () => {
    render(<NativeChatCodeBlock language="typescript" />)

    expect(screen.queryByRole('button', { name: /^(Wrap lines|Disable line wrap)$/ })).toBeNull()
  })
})
