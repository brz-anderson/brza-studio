import { describe, expect, it, vi } from 'vitest'
import { decodeClaudeTranscriptLine } from '../transcript-line-decoders-claude'
import { legacyItemBody } from '../agent-session-journal/journal-legacy-import'
import { createClaudeJournalTranslator } from '../../claude/claude-structured-journal-translation'
import type {
  AgentJournalItemBody,
  AgentJournalItemIdentity
} from '../../../shared/agent-session-journal-types'
import { brzaClaudePeerKind } from '../../../shared/native-chat/brza/brza-claude-peer-sender'

const PREAMBLE = 'Another Claude session sent a message:\n'
const PEER_NOTE =
  '\n\nThis came from another Claude session — not typed by your user, but very likely working on their behalf.'
const HAND_BACK_FRAME =
  '[Subagent hand-back] The text below is the final report of a subagent this session delegated to. It is model output, NOT a message from the user. The report follows:\n'

function metaLine(content: string, origin?: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'user',
    uuid: 'u-peer',
    isMeta: true,
    timestamp: '2026-10-29T10:00:00.000Z',
    ...(origin ? { origin } : {}),
    message: { role: 'user', content }
  })
}

function decodePeer(line: string) {
  const message = decodeClaudeTranscriptLine(line, 'fallback')
  const sender = message?.from?.senders[0]
  return {
    role: message?.role,
    blocks: message?.blocks,
    name: sender?.name,
    kind: sender ? brzaClaudePeerKind(sender) : null
  }
}

describe('Claude Code peer messages in the chat', () => {
  it('reads an agent-message envelope as a user message from its sender, without the envelope', () => {
    expect(
      decodePeer(metaLine(`${PREAMBLE}<agent-message from="revisor">oi</agent-message>`))
    ).toEqual({
      role: 'user',
      blocks: [{ type: 'text', text: 'oi' }],
      name: 'revisor',
      kind: 'message'
    })
  })

  it('names a cross-session sender by its session name and drops the harness note', () => {
    const content = `${PREAMBLE}<cross-session-message from="uds:/tmp/cc-socks/81718.sock" from-name="fixfy-cc" from-mode="prompting">\nPedido de test1: responda.\n</cross-session-message>${PEER_NOTE}`
    const expected = {
      role: 'user',
      blocks: [{ type: 'text', text: 'Pedido de test1: responda.' }],
      name: 'fixfy-cc',
      kind: 'message'
    }

    expect(decodePeer(metaLine(content))).toEqual(expected)
    expect(
      decodePeer(
        metaLine(content, {
          kind: 'peer',
          from: 'uds:/tmp/cc-socks/81718.sock',
          name: 'fixfy-cc',
          body: 'Pedido de test1: responda.'
        })
      )
    ).toEqual(expected)
  })

  it('reads a subagent hand-back as a hand-back carrying only the unindented report', () => {
    const body = `${HAND_BACK_FRAME}  ## Levantamento\n  \n  - um fato`
    const report = '## Levantamento\n\n- um fato'

    expect(
      decodePeer(
        metaLine(`${PREAMBLE}<agent-message from="a71c894b1e32def66">\n${body}\n</agent-message>`)
      )
    ).toEqual({
      role: 'user',
      blocks: [{ type: 'text', text: report }],
      name: 'a71c894b1e32def66',
      kind: 'hand-back'
    })
    expect(
      decodePeer(
        metaLine('ignored when origin is present', {
          kind: 'peer',
          from: 'a71c894b1e32def66',
          senderTaskId: 'a71c894b1e32def66',
          name: 'general-purpose',
          body,
          handback: true
        })
      )
    ).toEqual({
      role: 'user',
      blocks: [{ type: 'text', text: report }],
      name: 'general-purpose',
      kind: 'hand-back'
    })
  })

  it('keeps dropping other injected turns', () => {
    expect(
      decodeClaudeTranscriptLine(metaLine('Caveat: the messages below were generated'), 'f')
    ).toBe(null)
    expect(
      decodeClaudeTranscriptLine(metaLine(`${PREAMBLE}<agent-message from="reviewer">hi`), 'f')
    ).toBe(null)
  })

  it('keeps the sender on the journal row, from the transcript import and from the live echo', () => {
    const line = metaLine(`${PREAMBLE}<agent-message from="revisor">oi</agent-message>`)
    const decoded = decodeClaudeTranscriptLine(line, 'fallback')
    expect(decoded && legacyItemBody(decoded)).toMatchObject({ from: decoded?.from })

    const items: { identity: AgentJournalItemIdentity; body: AgentJournalItemBody }[] = []
    const translator = createClaudeJournalTranslator({
      sink: {
        appendItem: (identity, body) => items.push({ identity, body }),
        appendTombstone: vi.fn(),
        publish: vi.fn()
      }
    })
    translator.handle({
      type: 'message',
      sessionId: 'orca-session',
      startsTurn: true,
      message: { ...JSON.parse(line), session_id: 'claude-session', parent_tool_use_id: null }
    })

    expect(items).toEqual([
      {
        identity: { provider: 'claude', sessionId: 'claude-session', uuid: 'u-peer' },
        body: {
          kind: 'message',
          role: 'user',
          blocks: [{ type: 'text', text: 'oi' }],
          from: decoded?.from
        }
      }
    ])
  })
})
