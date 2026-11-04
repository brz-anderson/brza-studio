import type { AgentJournalCursor } from '../../shared/agent-session-journal-identity'
import { RuntimeClientError } from '../runtime-client'

export function formatChatCursor(cursor: AgentJournalCursor): string {
  return `${cursor.epoch}:${cursor.sequence}`
}

export function parseChatCursor(value: string): AgentJournalCursor {
  const separator = value.lastIndexOf(':')
  const epoch = value.slice(0, separator)
  const sequenceText = value.slice(separator + 1)
  const sequence = Number(sequenceText)
  if (
    separator < 1 ||
    epoch.trim() !== epoch ||
    sequenceText.length === 0 ||
    !/^\d+$/.test(sequenceText) ||
    !Number.isSafeInteger(sequence)
  ) {
    throw new RuntimeClientError(
      'invalid_argument',
      'Cursor must have the form <epoch>:<sequence>.'
    )
  }
  return { epoch, sequence }
}
