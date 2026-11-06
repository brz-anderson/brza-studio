import { join } from 'node:path'
import type {
  NativeChatUsageLimitAutoResume,
  NativeChatUsageLimitAutoResumeCut
} from '../../shared/native-chat/native-chat-usage-limit-auto-resume'
import { readNodeFileWithinLimit } from '../../shared/node-bounded-file-reader'
import { stringifyJsonWithinByteLimit } from '../../shared/node-bounded-json-stringify'
import { durableWriteTempPath, writeFileDurable } from '../filesystem/durable-file-write'
import { withFileTransactionLock } from '../filesystem/file-transaction-lock'

export const AGENT_SESSION_USAGE_LIMIT_AUTO_RESUME_FILE =
  'agent-session-usage-limit-auto-resume.json'
const MAX_FILE_BYTES = 1024 * 1024

type FileState = {
  entries: NativeChatUsageLimitAutoResume[]
  declined: NativeChatUsageLimitAutoResumeCut[]
}

/** The chats' scheduled Continues, one per chat, durable across restarts, and the cuts a client's
 *  own default must not schedule again. An older host reads `entries` alone. */
export class AgentSessionUsageLimitAutoResumeFile {
  private readonly filePath: string

  constructor(stateDirectory: string) {
    this.filePath = join(stateDirectory, AGENT_SESSION_USAGE_LIMIT_AUTO_RESUME_FILE)
  }

  read(): Promise<NativeChatUsageLimitAutoResume[]> {
    return withFileTransactionLock(this.filePath, async () => (await this.readState()).entries)
  }

  /** Read, change and write as one transaction; `change` returns the entries to keep. */
  update<T>(
    change: (
      entries: NativeChatUsageLimitAutoResume[],
      declined: NativeChatUsageLimitAutoResumeCut[]
    ) => {
      entries: NativeChatUsageLimitAutoResume[]
      declined?: NativeChatUsageLimitAutoResumeCut[]
      result: T
    }
  ): Promise<T> {
    return withFileTransactionLock(this.filePath, async () => {
      const before = await this.readState()
      const changed = change(before.entries, before.declined)
      const { serialized } = stringifyJsonWithinByteLimit(
        { version: 1, entries: changed.entries, declined: changed.declined ?? before.declined },
        MAX_FILE_BYTES
      )
      await writeFileDurable(durableWriteTempPath(this.filePath), this.filePath, serialized)
      return changed.result
    })
  }

  private async readState(): Promise<FileState> {
    let raw: string
    try {
      raw = (await readNodeFileWithinLimit(this.filePath, MAX_FILE_BYTES)).buffer.toString('utf8')
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return { entries: [], declined: [] }
      }
      throw error
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      // A torn or foreign file schedules nothing; the next write replaces it.
      return { entries: [], declined: [] }
    }
    const record: Record<string, unknown> =
      typeof parsed === 'object' && parsed !== null ? { ...parsed } : {}
    return {
      entries: Array.isArray(record.entries) ? record.entries.flatMap(readEntry) : [],
      declined: Array.isArray(record.declined) ? record.declined.flatMap(readDeclined) : []
    }
  }
}

function readDeclined(value: unknown): NativeChatUsageLimitAutoResumeCut[] {
  if (typeof value !== 'object' || value === null) {
    return []
  }
  const { sessionId, turnItemId }: Record<string, unknown> = { ...value }
  return typeof sessionId === 'string' && typeof turnItemId === 'string'
    ? [{ sessionId, turnItemId }]
    : []
}

function readEntry(value: unknown): NativeChatUsageLimitAutoResume[] {
  if (typeof value !== 'object' || value === null) {
    return []
  }
  const record: Record<string, unknown> = { ...value }
  const { sessionId, turnItemId, resumeAt } = record
  return typeof sessionId === 'string' &&
    typeof turnItemId === 'string' &&
    typeof resumeAt === 'number' &&
    Number.isFinite(resumeAt)
    ? [{ sessionId, turnItemId, resumeAt }]
    : []
}
