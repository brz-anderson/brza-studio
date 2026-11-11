import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isAdmissibleAgentJournalItemBody } from '../../../shared/agent-session/journal/agent-session-journal-schemas'
import type { AgentJournalRenderItem } from '../../../shared/agent-session/journal/agent-session-journal-types'
import { projectStructuredItemToNativeChat } from '../../../shared/agent-session/view/structured-agent-session-projection'
import {
  claudeToolBody,
  claudeToolResults,
  readClaudeMessageEnvelope
} from '../../claude/structured/journal/claude-structured-item-translation'
import { claudeContentBlocks } from '../transcript-record-blocks'
import {
  awaitToolImageWrite,
  brzaToolResultImages,
  flushToolImageWrites
} from './brza-tool-result-images'

let temp = ''

vi.mock('../../../shared/app-environment', () => ({
  hasAppEnvironment: () => true,
  getAppEnvironment: () => ({ getPath: () => temp })
}))

const BYTES = Buffer.from('fake png bytes')
const PNG = {
  type: 'image',
  source: { type: 'base64', media_type: 'image/png', data: BYTES.toString('base64') }
}
const SHOT_PATH = (): string =>
  join(
    temp,
    'brza-tool-images',
    `${createHash('sha256').update(BYTES).digest('hex').slice(0, 16)}.png`
  )
const TOOL_RESULT = {
  type: 'tool_result',
  tool_use_id: 'tool-1',
  content: [{ type: 'text', text: 'see image' }, PNG]
}

beforeEach(() => {
  temp = mkdtempSync(join(tmpdir(), 'brza-tool-images-test-'))
})

afterEach(async () => {
  await flushToolImageWrites()
  rmSync(temp, { recursive: true, force: true })
})

describe('brzaToolResultImages', () => {
  it('writes a base64 image to a content-named temp file once', async () => {
    const first = brzaToolResultImages([PNG])
    const second = brzaToolResultImages([PNG])
    await flushToolImageWrites()

    expect(first).toEqual([{ type: 'image-ref', path: SHOT_PATH() }])
    expect(second).toEqual(first)
    expect(readFileSync(SHOT_PATH())).toEqual(BYTES)
    expect(readdirSync(join(temp, 'brza-tool-images'))).toHaveLength(1)
  })

  it('lets a read wait for the write the decode left running', async () => {
    const [image] = brzaToolResultImages([PNG])

    await awaitToolImageWrite(SHOT_PATH())
    expect(image).toEqual({ type: 'image-ref', path: SHOT_PATH() })
    expect(readFileSync(SHOT_PATH())).toEqual(BYTES)
    await expect(awaitToolImageWrite(join(temp, 'other.png'))).resolves.toBeUndefined()
  })

  it('reports a failed write to the read, and clears the mark on the next successful decode', async () => {
    writeFileSync(join(temp, 'brza-tool-images'), 'not a folder')
    brzaToolResultImages([PNG])

    await expect(awaitToolImageWrite(SHOT_PATH())).rejects.toThrow('tool_image_write_failed')

    rmSync(join(temp, 'brza-tool-images'))
    brzaToolResultImages([PNG])
    await expect(awaitToolImageWrite(SHOT_PATH())).resolves.toBeUndefined()
    expect(readFileSync(SHOT_PATH())).toEqual(BYTES)
  })

  it('keeps url images as urls and skips types the send path refuses', () => {
    expect(
      brzaToolResultImages([
        { type: 'image', source: { type: 'url', url: 'https://example.com/a.png' } },
        { type: 'image', source: { type: 'base64', media_type: 'image/bmp', data: 'AAAA' } },
        { type: 'text', text: 'not an image' }
      ])
    ).toEqual([{ type: 'image-ref', url: 'https://example.com/a.png' }])
  })
})

describe('tool-result images in the decoders', () => {
  it('reaches the live tool-call body beside the text output', async () => {
    const envelope = readClaudeMessageEnvelope({
      type: 'user',
      uuid: 'u-1',
      session_id: 's-1',
      message: { role: 'user', content: [TOOL_RESULT] }
    })
    const [result] = envelope ? claudeToolResults(envelope) : []
    const body = claudeToolBody({ tool: { id: 'tool-1', name: 'Read', input: {} }, result })

    await flushToolImageWrites()
    expect(readFileSync(SHOT_PATH())).toEqual(BYTES)
    expect(body).toMatchObject({
      output: { head: 'see image' },
      images: [{ type: 'image-ref', path: SHOT_PATH() }]
    })
    expect(isAdmissibleAgentJournalItemBody(body)).toBe(true)
  })

  it('reaches the history tool-result block beside the text output', () => {
    expect(claudeContentBlocks([TOOL_RESULT])).toEqual([
      {
        type: 'tool-result',
        output: 'see image',
        callId: 'tool-1',
        images: [{ type: 'image-ref', path: SHOT_PATH() }]
      }
    ])
  })

  it('projects journaled images to the renderer and rejects malformed ones', () => {
    const images = [{ type: 'image-ref' as const, path: '/tmp/shot.png' }]
    const item: AgentJournalRenderItem = {
      itemId: 'item-1',
      revision: 1,
      sequence: 1,
      observedAt: 1,
      body: {
        kind: 'tool-call',
        name: 'Read',
        input: {},
        callId: 'tool-1',
        state: 'completed',
        output: { head: 'see image', byteLength: 9, digest: 'd', truncated: false },
        images
      }
    }

    expect(projectStructuredItemToNativeChat(item)?.blocks[1]).toMatchObject({
      type: 'tool-result',
      images
    })
    expect(
      isAdmissibleAgentJournalItemBody({ ...item.body, images: [{ type: 'image-ref', path: 3 }] })
    ).toBe(false)
  })
})
