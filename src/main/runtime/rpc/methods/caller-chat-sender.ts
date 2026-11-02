import type { AgentMessageSender } from '../../../../shared/agent-session/agent-session-message-source'
import {
  isOrcaSessionId,
  ORCA_SESSION_ADDRESS_PREFIX,
  type OrcaSessionId
} from '../../../../shared/orca-session-address'
import type { RpcContext } from '../core'
import { isAgentRpcCaller } from '../rpc-caller-identity'

/** The chat an `orca` CLI call came from; windows, phones and remote CLIs act for a person. */
export function callerChatSessionId(
  context: Pick<RpcContext, 'caller' | 'orchestrationCompatibilityEvidence'>
): OrcaSessionId | undefined {
  const claimed = context.orchestrationCompatibilityEvidence?.agentSessionId
  return isAgentRpcCaller(context.caller) && claimed !== undefined && isOrcaSessionId(claimed)
    ? claimed
    : undefined
}

/** The calling chat as the coordinator of a task it hands to another chat, when a chat is calling. */
export function callerChatCoordinator(
  context: Pick<RpcContext, 'caller' | 'orchestrationCompatibilityEvidence' | 'runtime'>
): AgentMessageSender | undefined {
  const sessionId = callerChatSessionId(context)
  return sessionId === undefined ? undefined : coordinatorChatSender(context.runtime, sessionId)
}

function coordinatorChatSender(
  runtime: RpcContext['runtime'],
  sessionId: OrcaSessionId
): AgentMessageSender {
  return {
    ...runtime.orchestrationSenderNames.sender(`${ORCA_SESSION_ADDRESS_PREFIX}${sessionId}`),
    relation: 'coordinator'
  }
}
