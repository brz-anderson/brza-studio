import type { AgentJournalMessageItem } from '../../../shared/agent-session-journal-types'
import type { NativeChatMessage } from '../../../shared/native-chat-types'
import {
  brzaClaudePeerSource,
  type BrzaClaudePeerKind
} from '../../../shared/native-chat/brza/brza-claude-peer-sender'
import { asRecord, extractString } from '../../ai-vault/session-scanner-values'

type BrzaClaudePeerMessage = Readonly<{
  kind: BrzaClaudePeerKind
  /** The session socket or the subagent task: what tells two senders with one name apart. */
  id: string
  name: string | null
  text: string
}>

const PEER_PREAMBLE = 'Another Claude session sent a message:\n'
const HAND_BACK_MARK = '[Subagent hand-back]'
const REPORT_START = 'The report follows:\n'
// Claude Code 2.1.x frames; older transcripts carry only the text, newer ones also `origin`.
const AGENT_MESSAGE = /^<agent-message from="([^"]*)">\n?([\s\S]*?)\n?<\/agent-message>/
const CROSS_SESSION_MESSAGE =
  /^<cross-session-message from="([^"]*)"(?: from-name="([^"]*)")?[^>]*>\n?([\s\S]*?)\n?<\/cross-session-message>/

/** Another Claude Code session's message, or a subagent's hand-back, that Claude Code injects as a meta user turn. */
function readBrzaClaudePeerMessage(record: Record<string, unknown>): BrzaClaudePeerMessage | null {
  if (record.type !== 'user' || record.isMeta !== true) {
    return null
  }
  const origin = asRecord(record.origin)
  const originBody = extractString(origin?.body)
  const originId = extractString(origin?.senderTaskId) ?? extractString(origin?.from)
  if (origin?.kind === 'peer' && originBody !== null && originId !== null) {
    return peerMessage(originId, extractString(origin.name), originBody)
  }
  const text = recordText(asRecord(record.message)?.content)
  if (!text?.startsWith(PEER_PREAMBLE)) {
    return null
  }
  const envelope = text.slice(PEER_PREAMBLE.length)
  const agent = AGENT_MESSAGE.exec(envelope)
  if (agent) {
    return peerMessage(agent[1], agent[1], agent[2])
  }
  const crossSession = CROSS_SESSION_MESSAGE.exec(envelope)
  return crossSession
    ? peerMessage(crossSession[1], crossSession[2] ?? null, crossSession[3])
    : null
}

/** One user row for the live echo and the transcript line of the same turn. */
export function brzaClaudePeerJournalBody(
  frame: Record<string, unknown>
): AgentJournalMessageItem | null {
  const peer = readBrzaClaudePeerMessage(frame)
  return peer
    ? {
        kind: 'message',
        role: 'user',
        blocks: [{ type: 'text', text: peer.text }],
        from: brzaClaudePeerSource(peer.kind, peer.id, peer.name)
      }
    : null
}

export function brzaClaudePeerChatMessage(
  record: Record<string, unknown>,
  row: Pick<NativeChatMessage, 'id' | 'timestamp' | 'source' | 'parentId'>
): NativeChatMessage | null {
  const body = brzaClaudePeerJournalBody(record)
  return body ? { ...row, role: body.role, blocks: body.blocks, from: body.from } : null
}

function peerMessage(id: string, name: string | null, body: string): BrzaClaudePeerMessage | null {
  const handBack = body.startsWith(HAND_BACK_MARK)
  const text = (handBack ? handBackReport(body) : body).trim()
  return id && text ? { kind: handBack ? 'hand-back' : 'message', id, name, text } : null
}

// The harness indents every report line by two spaces so a forged frame cannot start a line.
function handBackReport(body: string): string {
  const start = body.indexOf(REPORT_START)
  const report =
    start === -1 ? body.slice(HAND_BACK_MARK.length) : body.slice(start + REPORT_START.length)
  return report
    .split('\n')
    .map((line) => (line.startsWith('  ') ? line.slice(2) : line.trimEnd()))
    .join('\n')
}

function recordText(content: unknown): string | null {
  if (typeof content === 'string') {
    return content
  }
  if (!Array.isArray(content)) {
    return null
  }
  const texts = content.flatMap((part) => {
    const text = extractString(asRecord(part)?.text)
    return text === null ? [] : [text]
  })
  return texts.length > 0 ? texts.join('\n') : null
}
