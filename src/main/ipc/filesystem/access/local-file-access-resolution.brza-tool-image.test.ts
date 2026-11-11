import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { installFakeAppEnvironment } from '../../../../../config/scripts/test-runtime/environment/vitest-host-ports-setup'
import {
  brzaToolResultImages,
  flushToolImageWrites
} from '../../../native-chat/brza/brza-tool-result-images'
import type { Store } from '../../../persistence/loading-store/store'
import { invalidateAuthorizedRootsCache } from '../../worktrees/removal/registered-worktree-roots-cache'
import { resolveLocalFileRequestPath } from './local-file-access-resolution'

const { temp } = vi.hoisted(() => ({ temp: { path: '' } }))

vi.mock('electron', () => ({ app: { getPath: () => temp.path } }))

// A 1x1 PNG: the chat-image rule checks the type of what it reads.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)
const CHAT_IMAGE = { kind: 'chat-image' } as const
const toolImage = (): { type: string; source: unknown } => ({
  type: 'image',
  source: { type: 'base64', media_type: 'image/png', data: PNG.toString('base64') }
})
const store = {
  getRepos: () => [],
  getProjects: () => [],
  getProjectGroups: () => [],
  getFolderWorkspaces: () => [],
  getSettings: () => ({ nestWorkspaces: false, workspaceDir: '' })
} as unknown as Store

beforeEach(async () => {
  temp.path = await mkdtemp(join(await realpath(tmpdir()), 'brza-tool-image-read-'))
  installFakeAppEnvironment({ getPath: () => temp.path })
  invalidateAuthorizedRootsCache()
})

afterEach(async () => {
  await flushToolImageWrites()
  await rm(temp.path, { recursive: true, force: true })
})

describe('chat-image read of a tool-result image', () => {
  it('waits for the write the decode started and then resolves the image', async () => {
    const [image] = brzaToolResultImages([toolImage()])
    const path = (image && 'path' in image ? image.path : '') ?? ''

    await expect(resolveLocalFileRequestPath(path, CHAT_IMAGE, store)).resolves.toBe(path)
  })

  it('refuses explicitly when the write failed, leaving no phantom image', async () => {
    // A file where the image folder belongs makes the write fail.
    await mkdir(temp.path, { recursive: true })
    await writeFile(join(temp.path, 'brza-tool-images'), 'not a folder')
    const [image] = brzaToolResultImages([toolImage()])
    const path = (image && 'path' in image ? image.path : '') ?? ''

    await expect(resolveLocalFileRequestPath(path, CHAT_IMAGE, store)).rejects.toThrow(
      'tool_image_write_failed'
    )
  })
})
