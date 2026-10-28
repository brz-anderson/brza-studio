// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NativeChatToolLine } from '../NativeChatToolLine'
import { NativeChatMarkdownImageOwnerContext } from '../native-chat-markdown-image-owner'
import type {
  NativeChatToolCallBlock,
  NativeChatToolResultBlock
} from '../../../../../shared/native-chat-types'

const mocks = vi.hoisted(() => ({
  commitCompare: vi.fn(),
  openCommitAllDiffs: vi.fn()
}))

vi.mock('@/runtime/runtime-git-diff-client', () => ({
  getRuntimeGitCommitCompare: mocks.commitCompare
}))

vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ openCommitAllDiffs: mocks.openCommitAllDiffs }) }
}))

vi.mock('@/components/right-sidebar/worktree-git-owner-target', () => ({
  getWorktreeGitOwnerTarget: () => ({ kind: 'local' }),
  requireGitOwnerTarget: (target: unknown) => target
}))

vi.mock('@/lib/connection-context', () => ({ getConnectionId: () => null }))

vi.mock('@/lib/syntax-highlighting/oniguruma', async () => ({
  loadOniguruma: (await import('@/lib/syntax-highlighting/oniguruma-test-harness'))
    .loadNodeOniguruma
}))

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
  runtimeContext: null,
  isVisible: true
}

const commit: NativeChatToolCallBlock = {
  type: 'tool-call',
  name: 'Bash',
  input: { command: 'git commit -m "feat: chip"' },
  state: 'completed'
}
const committed: NativeChatToolResultBlock = {
  type: 'tool-result',
  output: '[main 9f8e7d6] feat: chip\n 1 file changed, 2 insertions(+)',
  isError: false
}
const summary = {
  commitOid: '9f8e7d6aaaa',
  parentOid: 'p',
  compareRef: '9f8e7d6',
  baseRef: 'p',
  changedFiles: 1,
  status: 'ready' as const
}

function renderLine(result?: NativeChatToolResultBlock, value: Owner | null = owner): void {
  render(
    <NativeChatMarkdownImageOwnerContext.Provider value={value}>
      <NativeChatToolLine block={commit} result={result} />
    </NativeChatMarkdownImageOwnerContext.Provider>
  )
}

beforeEach(() => {
  mocks.commitCompare.mockReset()
  mocks.openCommitAllDiffs.mockReset()
})

afterEach(cleanup)

describe('BrzaToolLineChip', () => {
  it('opens the committed diff in the chat worktree without toggling the row', async () => {
    mocks.commitCompare.mockResolvedValue({ summary, entries: [] })
    renderLine(committed)

    expect(screen.getByText('git commit — feat: chip')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /9f8e7d6/ }))

    await waitFor(() =>
      expect(mocks.openCommitAllDiffs).toHaveBeenCalledWith(
        'wt-1',
        '/repo/wt-1',
        summary,
        [],
        'feat: chip'
      )
    )
    expect(mocks.commitCompare).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: 'wt-1', worktreePath: '/repo/wt-1' }),
      '9f8e7d6'
    )
    expect(screen.getByRole('button', { name: /git commit/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
  })

  it('shows no chip before the output and plain text outside a chat worktree', () => {
    renderLine()
    expect(screen.queryByText('9f8e7d6')).toBeNull()
    cleanup()

    renderLine(committed, null)
    expect(screen.getByText('9f8e7d6')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
