// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { NativeChatToolLine } from '../NativeChatToolLine'
import { NativeChatMarkdownImageOwnerContext } from '../native-chat-markdown-image-owner'
import type {
  NativeChatImageRefBlock,
  NativeChatToolCallBlock,
  NativeChatToolResultBlock
} from '../../../../../shared/native-chat-types'

type Owner = NonNullable<
  ComponentProps<typeof NativeChatMarkdownImageOwnerContext.Provider>['value']
>

const owner: Owner = {
  fileLinkContext: {
    worktreeId: 'wt-1',
    worktreePath: '/repo/wt-1',
    runtimeEnvironmentId: null,
    sourceTabId: 'chat-tab'
  },
  runtimeContext: {
    target: { kind: 'local' },
    worktreeId: 'wt-1',
    worktreePath: '/repo/wt-1',
    expectedExecutionHostId: 'local'
  },
  isVisible: true
}

const read: NativeChatToolCallBlock = {
  type: 'tool-call',
  name: 'Read',
  input: { file_path: '/repo/wt-1/shot.png' },
  state: 'completed'
}

function images(count: number): NativeChatImageRefBlock[] {
  return Array.from({ length: count }, (_, index) => ({
    type: 'image-ref',
    path: `/tmp/brza-tool-images/img-${index + 1}.png`
  }))
}

function renderLine(result: NativeChatToolResultBlock): HTMLElement {
  render(
    <NativeChatMarkdownImageOwnerContext.Provider value={owner}>
      <NativeChatToolLine block={read} result={result} />
    </NativeChatMarkdownImageOwnerContext.Provider>
  )
  const line = document.querySelector<HTMLElement>('button[aria-expanded]')
  if (!line) {
    throw new Error('tool line not rendered')
  }
  return line
}

const thumbnails = (): HTMLElement[] => screen.queryAllByRole('button', { name: /^View image: / })

afterEach(cleanup)

describe('BrzaToolImageStrip', () => {
  it('shows the result images below the title while the line is closed', () => {
    const line = renderLine({ type: 'tool-result', output: 'Read image', images: images(2) })

    expect(line).toHaveAttribute('aria-expanded', 'false')
    expect(thumbnails().map((thumbnail) => thumbnail.getAttribute('aria-label'))).toEqual([
      'View image: img-1.png',
      'View image: img-2.png'
    ])
    expect(line.compareDocumentPosition(thumbnails()[0])).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  })

  it('caps the closed line at four and opens it from the +N tile with every image', () => {
    const line = renderLine({ type: 'tool-result', output: 'Read images', images: images(6) })

    expect(thumbnails()).toHaveLength(4)
    const more = screen.getByRole('button', { name: 'Show all 6 images' })
    expect(more).toHaveTextContent('+2')

    fireEvent.click(more)

    expect(line).toHaveAttribute('aria-expanded', 'true')
    expect(thumbnails()).toHaveLength(6)
    expect(screen.queryByRole('button', { name: 'Show all 6 images' })).toBeNull()
  })

  it('leaves a line without images unchanged', () => {
    renderLine({ type: 'tool-result', output: 'plain text' })

    expect(thumbnails()).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /^Show all / })).toBeNull()
  })
})
