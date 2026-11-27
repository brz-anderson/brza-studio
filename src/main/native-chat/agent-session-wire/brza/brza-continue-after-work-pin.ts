import { randomUUID } from 'node:crypto'
import type { AgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import { computeAgentSessionPayloadFingerprint } from '../../../../shared/agent-session/lifecycle/operations/agent-session-mutation-envelope'
import type { StructuredConversationCommandController } from '../operations/structured-conversation-command-controller'

/** The account a chat is pinned to (P36): null is System default, undefined is no pin. */
export const brzaPinOf = (
  record: Pick<AgentSessionRecord, 'accountSwitch'>
): string | null | undefined => (record.accountSwitch ? record.accountSwitch.accountId : undefined)

/** A refused switch tries again on a later publish, but no sooner than this: its own refusal may
 *  publish the chat's status. */
export const BRZA_PIN_SWITCH_RETRY_MS = 2_000

/** The pin switch the host runs for the person, as the composer's picker would (PLN-026, D5). R8.2:
 *  an account that cannot take the chat ends the wait; any other refusal (a turn, a message still
 *  settling) waits. */
export async function brzaSwitchPin(input: {
  sessionId: string
  accountId: string | null
  fence: number
  at: number
  switchAccount: (
    params: Parameters<StructuredConversationCommandController['switchAccount']>[1]
  ) => ReturnType<StructuredConversationCommandController['switchAccount']>
}): Promise<'switched' | 'wait' | 'unavailable'> {
  const { sessionId, accountId } = input
  const switched = await input.switchAccount({
    accountId,
    envelope: {
      sessionId,
      clientOperationId: `${Math.trunc(input.at).toString().padStart(13, '0')}-${randomUUID().replaceAll('-', '')}`,
      expectedRuntimeFence: input.fence,
      payloadFingerprint: computeAgentSessionPayloadFingerprint({
        method: 'agentSession.switchAccount',
        sessionId,
        fields: { accountId }
      })
    }
  })
  if (switched.ok) {
    return 'switched'
  }
  const reason = switched.refusal.details?.reason
  return reason === 'claudeAccountFolderMissing' || reason === 'claudeAccountSetupFailed'
    ? 'unavailable'
    : 'wait'
}
