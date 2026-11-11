import { createHash } from 'node:crypto'
import { access, mkdir, rename, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { getAppEnvironment, hasAppEnvironment } from '../../../shared/app-environment'
import type { NativeChatImageRefBlock } from '../../../shared/native-chat/native-chat-types'
import { asRecord } from '../../ai-vault/session-scanner-values'

// The image types the Claude send path accepts (claude-structured-dispatch-content.ts).
const EXTENSION_BY_MEDIA_TYPE: Record<string, string> = {
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
}

function toolImagesFolder(): string {
  return join(
    hasAppEnvironment() ? getAppEnvironment().getPath('temp') : tmpdir(),
    'brza-tool-images'
  )
}

// Writes still running, by path: the decoders are synchronous, so the file lands just after the path is returned.
const pendingWrites = new Map<string, Promise<void>>()

async function persistToolImage(filePath: string, bytes: Buffer): Promise<void> {
  try {
    await access(filePath)
    return
  } catch {
    // Absent: write it below.
  }
  await mkdir(dirname(filePath), { recursive: true })
  const partial = `${filePath}.${process.pid}.partial`
  await writeFile(partial, bytes)
  await rename(partial, filePath)
}

/** Named by content digest, so the live and history decodes of one result share a file and a cleaned temp refills on the next decode. */
function writeToolImage(bytes: Buffer, extension: string): string {
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
  const filePath = join(toolImagesFolder(), `${digest}.${extension}`)
  if (!pendingWrites.has(filePath)) {
    const write = persistToolImage(filePath, bytes)
      .catch(() => undefined)
      .finally(() => pendingWrites.delete(filePath))
    pendingWrites.set(filePath, write)
  }
  return filePath
}

/** Resolves when every image file a decode started has landed; for tests and shutdown. */
export async function flushToolImageWrites(): Promise<void> {
  await Promise.all(pendingWrites.values())
}

function toolResultImage(entry: unknown): NativeChatImageRefBlock | null {
  const part = asRecord(entry)
  const source = asRecord(part?.source)
  if (part?.type !== 'image' || !source) {
    return null
  }
  if (source.type === 'url') {
    return typeof source.url === 'string' && source.url
      ? { type: 'image-ref', url: source.url }
      : null
  }
  const extension =
    typeof source.media_type === 'string' ? EXTENSION_BY_MEDIA_TYPE[source.media_type] : undefined
  if (source.type !== 'base64' || !extension || typeof source.data !== 'string') {
    return null
  }
  const bytes = Buffer.from(source.data, 'base64')
  return bytes.byteLength > 0 ? { type: 'image-ref', path: writeToolImage(bytes, extension) } : null
}

/** The images of a Claude `tool_result` content; the text stays with the decoders. */
export function brzaToolResultImages(content: unknown): NativeChatImageRefBlock[] {
  if (!Array.isArray(content)) {
    return []
  }
  return content.flatMap((entry) => {
    const image = toolResultImage(entry)
    return image ? [image] : []
  })
}
