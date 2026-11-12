// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { resetLocalImageCacheState as resetLocalImageSrcStateForTests } from '@/components/editor/document-images/local-image-src-cache'
import type { FileLinkExists } from '../../../../shared/native-chat/native-chat-file-link-tree'
import { useAppStore } from '@/store'
import { NativeChatLinkClickContext } from './links/actions/native-chat-link-click-context'
import { NativeChatMarkdown } from './markdown/NativeChatMarkdown'
import { NativeChatFileLinkExistenceContext } from './links/actions/native-chat-file-link-existence'
import type { NativeChatFileLinkExistence } from '../../../../shared/native-chat/native-chat-file-link-existence'
import { NativeChatMarkdownImageOwnerContext } from './media/images/native-chat-markdown-image-owner'
import { repoFixture, worktreeFixture } from './surfaces/integration/native-chat-workspace-test-fixtures'

const mocks = vi.hoisted(() => ({ readRuntimeFilePreview: vi.fn() }))

vi.mock('@/runtime/files/reads/runtime-file-read-client', () => ({
  readRuntimeFilePreview: mocks.readRuntimeFilePreview
}))

const onlyShotExists: FileLinkExists = (link) => link.pathText === '/abs/shot.png'
const shotSnapshot = { check: onlyShotExists, peek: onlyShotExists }
const shotExistence: NativeChatFileLinkExistence = {
  watch: () => ({ subscribe: () => () => {}, getSnapshot: () => shotSnapshot }),
  recheck: () => {}
}

const localOwner = {
  fileLinkContext: {
    worktreeId: 'wt-1',
    worktreePath: '/repo/worktree',
    runtimeEnvironmentId: null,
    sourceTabId: 'tab-1'
  },
  runtimeContext: {
    target: { kind: 'local' as const },
    worktreeId: 'wt-1',
    worktreePath: '/repo/worktree',
    expectedExecutionHostId: 'local' as const
  },
  isVisible: true
}

beforeEach(() => {
  resetLocalImageSrcStateForTests()
  vi.stubGlobal('IntersectionObserver', undefined)
  const worktree = worktreeFixture('wt-1', '/repo/worktree', { hostId: 'local' })
  useAppStore.setState({
    ...useAppStore.getInitialState(),
    repos: [repoFixture()],
    worktreesByRepo: { repo: [worktree] },
    activeWorktreeId: 'wt-1',
    activeWorkspaceExecutionHostId: 'local'
  })
  let sequence = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:image-${++sequence}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  mocks.readRuntimeFilePreview.mockResolvedValue({
    content: 'AA==',
    isBinary: true,
    mimeType: 'image/png'
  })
})

afterEach(() => {
  cleanup()
  resetLocalImageSrcStateForTests()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('native chat Markdown BrzA image thumbnails', () => {
  it('shows a BrzA thumbnail below a settled paragraph naming an image, once per image and only once it loads', async () => {
    const content = [
      'Saved `/abs/shot.png`, then `/abs/shot.png` again.',
      '![Shot](other.png) is [the same](other.png).',
      'Remote https://cdn.example.com/a.png and https://cdn.example.com/broken.png.'
    ].join('\n\n')
    const reply = (streaming: boolean): React.JSX.Element => (
      <TooltipProvider>
        <NativeChatLinkClickContext value={() => {}}>
          <NativeChatFileLinkExistenceContext.Provider value={shotExistence}>
            <NativeChatMarkdownImageOwnerContext.Provider value={localOwner}>
              <NativeChatMarkdown
                content={content}
                variant="document"
                streaming={streaming}
                linkifyFilePaths
              />
            </NativeChatMarkdownImageOwnerContext.Provider>
          </NativeChatFileLinkExistenceContext.Provider>
        </NativeChatLinkClickContext>
      </TooltipProvider>
    )
    const triggers = (hidden = false): HTMLElement[] =>
      screen.queryAllByRole('button', { name: /^View image/, hidden })
    const remote = (src: string): HTMLElement => {
      const image = screen
        .getAllByRole('img', { hidden: true })
        .find((img) => img.getAttribute('src') === src)
      if (!image) {
        throw new Error(`no image ${src}`)
      }
      return image
    }

    const view = render(reply(true))
    expect(triggers(true)).toHaveLength(1)

    view.rerender(reply(false))
    expect(screen.getAllByRole('link', { name: '/abs/shot.png' })).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'the same' })).toBeInTheDocument()
    expect(triggers(true)).toHaveLength(4)
    expect(triggers().map((trigger) => trigger.getAttribute('aria-label'))).toEqual([
      'View image: Shot'
    ])

    fireEvent.load(await screen.findByRole('img', { name: 'shot.png', hidden: true }))
    fireEvent.load(remote('https://cdn.example.com/a.png'))
    fireEvent.error(remote('https://cdn.example.com/broken.png'))
    expect(triggers().map((trigger) => trigger.getAttribute('aria-label'))).toEqual([
      'View image: shot.png',
      'View image: Shot',
      'View image: Image'
    ])
  })
})
