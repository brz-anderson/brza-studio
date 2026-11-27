import { structuredAgentSessionMessageSendMutation } from '../../../../shared/agent-session/requests/structured-agent-session-send-mutation'
import type { AgentSessionRecordStore } from '../../../runtime/agent-session/records/agent-session-record-store'
import type { StructuredAgentSessionHostDeps } from '../host/structured-agent-session-host-types'
import type { HostUsageLimitCut } from '../recovery/structured-agent-session-usage-limit-chain'
import type { UsageLimitContinueDeps } from '../recovery/structured-agent-session-usage-limit-continue-deps'
import { usageLimitContinueMutation } from '../recovery/structured-agent-session-usage-limit-continue-message'

export type BrzaContinueSendDeps = {
  store: () => Pick<AgentSessionRecordStore, 'getRecord' | 'getConversation' | 'hostId'>
  readCut: (sessionId: string) => Promise<HostUsageLimitCut | null>
  send: UsageLimitContinueDeps['send']
  now: () => number
  logger: () => StructuredAgentSessionHostDeps['logger']
}

/** The newest cut's continue: it releases the agent and starts it on the chosen account. With
 *  `notices`, the stopped agent never woke up for its tasks, so they travel in the body. */
export async function sendBrzaContinue(
  deps: BrzaContinueSendDeps,
  input: { sessionId: string; notices: string; fence: number | undefined }
): Promise<void> {
  const { sessionId, notices, fence } = input
  const cut = await deps.readCut(sessionId)
  // No cut left: the wake-up went through on the old account, so nothing is cut off any more.
  if (!cut || fence === undefined) {
    return
  }
  const base = await usageLimitContinueMutation({
    sessionId,
    cut,
    at: deps.now(),
    expectedRuntimeFence: fence
  })
  const result = await deps.send(
    notices
      ? structuredAgentSessionMessageSendMutation({
          sessionId,
          clientOperationId: base.envelope.clientOperationId,
          expectedRuntimeFence: fence,
          body: { ...base.body, blocks: [...base.body.blocks, { type: 'text', text: notices }] },
          usageLimitContinuationOfTurnItemId: cut.turnItemId
        })
      : base
  )
  // Superseded: the automatic continue reached the newer cut first and already moved the chat.
  if (!result.ok && result.refusal.details?.reason !== 'continuationSuperseded') {
    deps.logger().warn('the deferred continue in another account was refused', {
      scope: 'brza-continue-after-work',
      sessionId,
      reason: result.refusal.details?.reason
    })
  }
}
