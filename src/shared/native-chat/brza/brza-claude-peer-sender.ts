import {
  agentMessageSenderName,
  type AgentMessageSender,
  type AgentMessageSource
} from '../../agent-session/agent-session-message-source'

export type BrzaClaudePeerKind = 'message' | 'hand-back'

// The kind rides in the address, so the upstream source contract and its stored rows stay unchanged.
const ADDRESS_PREFIX: Record<BrzaClaudePeerKind, string> = {
  message: 'claude-peer:',
  'hand-back': 'claude-hand-back:'
}

/** A Claude Code session or subagent as an agent-message sender; Orca's mailbox has no record of it. */
export function brzaClaudePeerSource(
  kind: BrzaClaudePeerKind,
  id: string,
  name: string | null
): AgentMessageSource {
  return {
    kind: 'agent',
    senders: [
      {
        party: {
          address: `${ADDRESS_PREFIX[kind]}${id}`,
          terminalHandle: null,
          orcaSessionId: null
        },
        name: agentMessageSenderName(name)
      }
    ],
    orchestration: null
  }
}

export function brzaClaudePeerKind(sender: AgentMessageSender): BrzaClaudePeerKind | null {
  if (sender.party.address.startsWith(ADDRESS_PREFIX.message)) {
    return 'message'
  }
  return sender.party.address.startsWith(ADDRESS_PREFIX['hand-back']) ? 'hand-back' : null
}

/** Every sender handed a subagent report back, so the row reads "Hand-back from". */
export function brzaClaudeHandBack(from: AgentMessageSource): boolean {
  return (
    from.senders.length > 0 &&
    from.senders.every((sender) => brzaClaudePeerKind(sender) === 'hand-back')
  )
}
