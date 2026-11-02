import type {
  AgentMessageSender,
  AgentMessageSource
} from '../../../shared/agent-session/agent-session-message-source'

/** A chat's task for another chat with no Dispatch behind it: the three ids only give the message the
 *  shape of a task, and name no record. */
export function chatTaskSource(
  coordinator: AgentMessageSender,
  operationId: string
): AgentMessageSource {
  return {
    kind: 'agent',
    senders: [coordinator],
    orchestration: {
      message: 'task',
      runId: operationId,
      taskId: operationId,
      dispatchId: operationId
    }
  }
}
