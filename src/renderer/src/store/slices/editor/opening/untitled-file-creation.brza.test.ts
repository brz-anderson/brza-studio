import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EditorGet } from '../types/editor-set-get'
import type { UntitledMarkdownFileInfo } from '@/lib/editor/file-operations/create-untitled-markdown'

vi.mock('@/lib/editor/file-operations/editor-file-operation-provenance', () => ({
  assertEditorFileOperationCurrent: vi.fn(),
  captureEditorFileOperationProvenance: vi.fn(() => ({}))
}))
vi.mock('@/lib/editor/file-operations/editor-file-operation-owner', () => ({
  getEditorFileOperationContext: vi.fn(() => ({
    connectionId: undefined,
    target: { kind: 'local' },
    expectedExecutionHostId: 'local'
  }))
}))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

import { createUntitledFileInActiveWorkspace } from './untitled-file-creation'

const openFile = vi.fn<(...args: unknown[]) => string>()
const setMarkdownViewMode = vi.fn()

function fileInfo(language: string): UntitledMarkdownFileInfo {
  return {
    filePath: '/repo/untitled',
    relativePath: 'untitled',
    worktreeId: 'wt',
    language,
    isUntitled: true,
    mode: 'edit'
  }
}

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the code under test reads only these four fields of the editor slice.
const get = (() => ({
  activeWorktreeId: 'wt',
  getKnownWorktreeById: () => ({ path: '/repo' }),
  openFile,
  setMarkdownViewMode
})) as unknown as EditorGet

describe('a file the user just created', () => {
  beforeEach(() => {
    openFile.mockReset().mockReturnValue('file-1')
    setMarkdownViewMode.mockReset()
  })

  it('opens a new Markdown file in the rich editor, not the preview default', async () => {
    await createUntitledFileInActiveWorkspace(get, undefined, async () => fileInfo('markdown'), 'x')
    expect(openFile).toHaveBeenCalledTimes(1)
    expect(setMarkdownViewMode).toHaveBeenCalledWith('file-1', 'rich')
  })

  it('leaves the view mode of a new file that is not Markdown alone', async () => {
    await createUntitledFileInActiveWorkspace(
      get,
      undefined,
      async () => fileInfo('typescript'),
      'x'
    )
    expect(openFile).toHaveBeenCalledTimes(1)
    expect(setMarkdownViewMode).not.toHaveBeenCalled()
  })
})
