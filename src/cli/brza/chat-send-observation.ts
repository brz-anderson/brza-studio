import type {
  AgentSessionHistoryResult,
  AgentSessionMutationResult,
  AgentSessionSendResult
} from '../../shared/agent-session/agent-session-wire'
import type { RuntimeClient } from '../runtime-client'
import { isChatHistoryTransportError } from './chat-history-transport'

export async function observePendingChatSend(
  client: Pick<RuntimeClient, 'call'>,
  session: string,
  result: AgentSessionMutationResult<AgentSessionSendResult>
): Promise<AgentSessionMutationResult<AgentSessionSendResult>> {
  if (
    result.ok &&
    'submission' in result.value &&
    result.value.submission.dispatchState === 'pending'
  ) {
    const started = Date.now()
    const deadline = started + 30_000
    let transportReason: string | null = null
    const pendingMessageId = result.value.clientMessageId
    while (Date.now() - started < 30_000) {
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(500, Math.max(0, deadline - Date.now())))
      )
      try {
        const latest = await client.call<AgentSessionHistoryResult>(
          'agentSession.history',
          {
            sessionId: session,
            direction: 'tail',
            limit: 1
          },
          { timeoutMs: Math.max(0, deadline - Date.now()) }
        )
        transportReason = null
        const resolved = latest.result.page.submissions.find(
          (entry) => entry.clientMessageId === pendingMessageId
        )
        if (resolved && resolved.dispatchState !== 'pending') {
          result = {
            ...result,
            value: { clientMessageId: resolved.clientMessageId, submission: resolved }
          }
          break
        }
      } catch (error) {
        if (!isChatHistoryTransportError(error)) {
          throw error
        }
        transportReason = error.message
      }
    }
    if (transportReason && 'submission' in result.value) {
      result = {
        ...result,
        value: {
          ...result.value,
          submission: { ...result.value.submission, reason: transportReason }
        }
      }
    }
  }

  return result
}
