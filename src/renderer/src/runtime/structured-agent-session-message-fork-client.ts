import type { AgentSessionMessageForkResult } from '../../../shared/agent-session-message-fork'
import type { RuntimeClientTarget } from '../../../shared/runtime-client-target'
import { callRuntimeRpc } from './rpc/calls/runtime-rpc-call'

/** Copies the chat's conversation through one agent message into a new provider session, for a
 *  new chat to resume. Only a host advertising the message-fork capability is asked. */
export function forkStructuredAgentSessionThroughMessage(
  target: RuntimeClientTarget,
  sessionId: string,
  itemId: string
): Promise<AgentSessionMessageForkResult> {
  return callRuntimeRpc<AgentSessionMessageForkResult>(target, 'agentSession.forkThroughMessage', {
    sessionId,
    itemId
  })
}
