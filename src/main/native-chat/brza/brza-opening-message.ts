import {
  AGENT_MESSAGE_SOURCE,
  USER_MESSAGE_SOURCE
} from '../../../shared/agent-session/agent-session-message-source'
import type { StructuredAgentSessionFirstMessage } from '../../../shared/agent-session/structured-agent-session-create'

/** The opening message of a chat as the send takes it, and who wrote it. Another agent's task is host-written, like the Dispatch
 *  tasks that carry `from`; anything else is the person's own message. */
export function brzaOpeningMessage(first: StructuredAgentSessionFirstMessage) {
  return {
    clientMessageId: first.clientMessageId,
    ...(first.selection !== undefined ? { selection: first.selection } : {}),
    origin: first.from ? ('host' as const) : ('client' as const),
    source: first.from ? AGENT_MESSAGE_SOURCE : USER_MESSAGE_SOURCE,
    body: first.from ? { ...first.body, from: first.from } : first.body
  }
}
