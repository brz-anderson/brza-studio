import { randomUUID } from 'node:crypto'
import { createStructuredAgentSessionOperationId } from '../../../../shared/agent-session/lifecycle/operations/structured-agent-session-mutation'
import type { AgentSessionRecord } from '../../../../shared/agent-session/lifecycle/agent-session-record'
import { computeAgentSessionPayloadFingerprint } from '../../../../shared/agent-session/lifecycle/operations/agent-session-mutation-envelope'
import type { BrzaContinueAfterWorkRequest } from '../../../../shared/rpc-contract/brza/brza-continue-after-work-params'
import type { AgentSessionRecordStore } from '../../../runtime/agent-session/records/agent-session-record-store'
import type { StructuredConversationCommandController } from '../operations/structured-conversation-command-controller'
import type { HostUsageLimitCut } from '../recovery/structured-agent-session-usage-limit-chain'

/** A deferred continue, as the host holds it (PLN-026, D1, D5). */
export type BrzaPendingContinue = {
  turnItemId: string
  account: string
  target: NonNullable<BrzaContinueAfterWorkRequest['target']>
  accountId?: string | null
  armedAt: number
  fallbackAt?: number
  /** The work was done with no cut yet after this failed turn; its limit row may be on its way. */
  cutMissing?: { turnId: string; at: number }
  /** `pin`: the chat's pin when the person chose; another since means the composer moved it. */
  pinAtArm?: string | null
  /** `pin`: a wake-up that never came, carried across a switch that has to wait. */
  notices?: string
  /** `pin`: after a switch that did not happen, no new attempt before this. */
  retryAt?: number
}

export type BrzaPinSwitch = (
  params: Parameters<StructuredConversationCommandController['switchAccount']>[1],
  options?: Parameters<StructuredConversationCommandController['switchAccount']>[2]
) => ReturnType<StructuredConversationCommandController['switchAccount']>

/** The account a chat is pinned to (P36): null is System default, undefined is no pin. */
export const brzaPinOf = (
  record: Pick<AgentSessionRecord, 'accountSwitch'>
): string | null | undefined => (record.accountSwitch ? record.accountSwitch.accountId : undefined)

/** A switch that did not happen tries again on a later publish, but no sooner than this: its own
 *  refusal may publish the chat's status. */
const BRZA_PIN_SWITCH_RETRY_MS = 2_000

/** What a pinned wait decides before the work does: the composer moved the pin since (cancel), the
 *  wait ran out (expire), or a switch tried a moment ago (wait). Null: as the work decides. */
export function brzaPinnedVerdict(
  record: Pick<AgentSessionRecord, 'accountSwitch'>,
  pending: BrzaPendingContinue,
  now: number,
  expired: boolean
): 'cancel' | 'expire' | 'wait' | null {
  if (brzaPinOf(record) !== pending.pinAtArm) {
    return 'cancel'
  }
  if (expired) {
    return 'expire'
  }
  return pending.retryAt !== undefined && now < pending.retryAt ? 'wait' : null
}

/** The pin switch the host runs for the person, as the composer's picker would (D5). R8.2: an
 *  account that cannot take the chat ends the wait; any other refusal, or a switch that throws,
 *  waits (R5). A wait no longer wanted when the lane is reached is refused untouched (B1). */
async function brzaSwitchPin(input: {
  sessionId: string
  accountId: string | null
  fence: number
  at: number
  switchAccount: BrzaPinSwitch
  stillWanted: () => boolean
}): Promise<'switched' | 'wait' | 'unavailable'> {
  const { sessionId, accountId } = input
  const switched = await input.switchAccount(
    {
      accountId,
      envelope: {
        sessionId,
        clientOperationId: createStructuredAgentSessionOperationId(randomUUID, input.at),
        expectedRuntimeFence: input.fence,
        payloadFingerprint: computeAgentSessionPayloadFingerprint({
          method: 'agentSession.switchAccount',
          sessionId,
          fields: { accountId }
        })
      }
    },
    { stillWanted: input.stillWanted }
  )
  if (switched.ok) {
    return 'switched'
  }
  const reason = switched.refusal.details?.reason
  return reason === 'claudeAccountFolderMissing' || reason === 'claudeAccountSetupFailed'
    ? 'unavailable'
    : 'wait'
}

/** The pinned chat's switch now that nothing is owed, then the continue on the fence it left. The
 *  switch stops the agent itself, once its account is ready, so a switch that does not happen leaves
 *  the agent and its tasks' result where they were (R6). */
export async function brzaSwitchPinThenContinue(input: {
  sessionId: string
  pending: BrzaPendingContinue
  deps: {
    store: () => Pick<AgentSessionRecordStore, 'getRecord' | 'getConversation'>
    readCut: (sessionId: string) => Promise<HostUsageLimitCut | null>
    switchAccount: BrzaPinSwitch
    now: () => number
  }
  stillWanted: () => boolean
  /** Under the chat's serialization: ends the wait if it is still this one, and says so. */
  settle: (ending: 'accountUnavailable' | undefined, cutItemId?: string) => Promise<boolean>
  recheckAt: (when: number) => void
  continueOn: (fence: number) => Promise<void>
  warn: (error: unknown) => void
}): Promise<void> {
  const { sessionId, pending, deps } = input
  const record = deps.store().getRecord(sessionId)
  const fence = deps.store().getConversation(sessionId)?.currentFence
  const { accountId } = pending
  if (!record || fence === undefined || accountId === undefined) {
    return
  }
  const at = deps.now()
  const outcome = await brzaSwitchPin({
    sessionId,
    accountId,
    fence: record.lease.runtimeFence,
    at,
    switchAccount: deps.switchAccount,
    stillWanted: input.stillWanted
  }).catch((error: unknown) => {
    input.warn(error)
    return 'wait' as const
  })
  if (!input.stillWanted() && outcome !== 'switched') {
    return
  }
  if (outcome === 'wait') {
    pending.retryAt = at + BRZA_PIN_SWITCH_RETRY_MS
    input.recheckAt(pending.retryAt)
    return
  }
  const cut = outcome === 'unavailable' ? await deps.readCut(sessionId) : null
  const ending = outcome === 'unavailable' ? 'accountUnavailable' : undefined
  if ((await input.settle(ending, cut?.turnItemId)) && outcome === 'switched') {
    await input.continueOn(fence)
  }
}
