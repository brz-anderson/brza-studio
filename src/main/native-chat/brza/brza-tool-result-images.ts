import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getAppEnvironment, hasAppEnvironment } from '../../../shared/app-environment'
import type { NativeChatImageRefBlock } from '../../../shared/native-chat-types'
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

/** Named by content digest, so the live and history decodes of one result share a file and a cleaned temp refills on the next decode. */
function writeToolImage(bytes: Buffer, extension: string): string | null {
  const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
  const filePath = join(toolImagesFolder(), `${digest}.${extension}`)
  try {
    if (!existsSync(filePath)) {
      mkdirSync(join(filePath, '..'), { recursive: true })
      const partial = `${filePath}.${process.pid}.partial`
      writeFileSync(partial, bytes)
      renameSync(partial, filePath)
    }
    return filePath
  } catch {
    return null
  }
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
  const filePath = bytes.byteLength > 0 ? writeToolImage(bytes, extension) : null
  return filePath ? { type: 'image-ref', path: filePath } : null
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
