import {
  AGENT_SESSION_ACCOUNT_SWITCHED_PRESENTATION,
  agentSessionAccountSwitchedText,
  type AgentSessionAccountSwitchParams,
  type AgentSessionAccountSwitchResult
} from '../../../../shared/agent-session-account-switch'
import { claudeAccountPinRefusal } from '../../../claude/claude-account-switch'
import type { AgentSessionMutationResult } from '../../../../shared/agent-session/agent-session-wire'
import { refuse } from '../../../../shared/agent-session/failures/agent-session-wire-refusals'
import type { AgentSessionAccountSwitch } from '../../../runtime/agent-session-account-switch-record'
import { admitAndRunAgentSessionMutation } from './structured-agent-session-mutation-admission'
import type { StructuredAgentSessionMutationContext } from './structured-agent-session-mutation-context'
import { sendPreparation } from './structured-agent-session-send-preparation'
import { runAfterRewindStart } from './structured-agent-session-ready-operation'
import type { ReadyOperationSelection } from './structured-agent-session-operation-child'
import type { StructuredAgentSessionCaller } from '../host/structured-agent-session-host-types'
import {
  readContextStructuredAgentSessionWork,
  readHostStructuredAgentSessionWork
} from '../observations/structured-agent-session-read-work'
import { hostStructuredAgentSessionCurrentWork } from '../observations/structured-agent-session-host-current-work'
import { conversationCommandBlocked } from './structured-conversation-command-admission'
import { brzaWakeUpDueAt } from '../brza/brza-continue-after-work-wake-up'

const METHOD = 'agentSession.switchAccount'
const WAKE_UP_OWED = refuse(
  'agent_session_operation_invalid',
  { reason: 'backgroundTasksRunning' },
  'Wait for background tasks to finish before using this command.'
)
const WITHDRAWN = refuse(
  'agent_session_operation_invalid',
  { reason: 'continuationSuperseded' },
  'The continue that asked for this switch was cancelled.'
)

/** For a switch the host makes for a deferred continue (PLN-026, D5): checked once the chat's lane
 *  is reached, so a Cancel queued before it keeps the chat where it is, its agent untouched. */
export type StructuredAccountSwitchOptions = { stillWanted?: () => boolean }

/** Moves a chat to another account as `/clear` does its context: the same tab and Orca session,
 *  the agent stopped, and a divider; the next start resumes the conversation in that account. */
export function runStructuredAccountSwitch(
  context: StructuredAgentSessionMutationContext,
  caller: StructuredAgentSessionCaller,
  params: AgentSessionAccountSwitchParams,
  options: StructuredAccountSwitchOptions = {}
): Promise<AgentSessionMutationResult<AgentSessionAccountSwitchResult>> {
  return runAfterRewindStart(
    context,
    caller.callerKey,
    params.envelope,
    { method: METHOD, fields: { accountId: params.accountId } },
    (selection) => switchUnderSerialize(context, caller, params, selection, options)
  )
}

async function switchUnderSerialize(
  context: StructuredAgentSessionMutationContext,
  caller: StructuredAgentSessionCaller,
  params: AgentSessionAccountSwitchParams,
  selection: ReadyOperationSelection,
  options: StructuredAccountSwitchOptions
): Promise<AgentSessionMutationResult<AgentSessionAccountSwitchResult>> {
  const { envelope, accountId } = params
  const { sessionId, clientOperationId } = envelope
  const store = context.deps.store
  const childWork = () => ({
    views: context.readChildWork(sessionId),
    open: context.childWorkOpen(sessionId)
  })
  let change: AgentSessionAccountSwitch | null = null
  return admitAndRunAgentSessionMutation({
    store,
    adapter: context.deps.adapter,
    agents: context.deps.agents,
    logger: context.deps.logger,
    callerKey: caller.callerKey,
    envelope,
    prepareSession: sendPreparation(context, envelope, { refusesInRun: true }, selection),
    journal: () => context.sessions.get(sessionId)?.journal,
    currentWork: () =>
      hostStructuredAgentSessionCurrentWork({ store, sessions: context.sessions }, sessionId),
    readWork: (operation) =>
      readHostStructuredAgentSessionWork(
        { store, sessions: context.sessions },
        sessionId,
        operation
      ),
    publish: (journal) => context.publish(sessionId, journal),
    now: context.now,
    plan: {
      method: METHOD,
      fields: { accountId },
      conversationWrite: true,
      recoverUnknownFromDurableState: true,
      settlesWithWrite: true,
      successReceipt: () =>
        store.conversationReceipts.accountSwitch(
          () => {
            if (!change) {
              throw new Error('agent_session_account_switch_not_completed')
            }
            return change
          },
          { callerKey: caller.callerKey, operationId: clientOperationId }
        ),
      replay: (_ctx, outcome) => {
        if (outcome.status === 'succeeded' && outcome.accountSwitch) {
          return outcome.accountSwitch
        }
        const recorded = store.getRecord(sessionId)?.accountSwitch
        return recorded?.operationId === clientOperationId &&
          recorded.callerKey === caller.callerKey
          ? { accountId: recorded.accountId, account: recorded.account }
          : null
      },
      // Without a committed record the chat never moved; a copied transcript is safe to copy again.
      rerunWhenReplayMissing: () => true,
      run: async (ctx) => {
        if (options.stillWanted?.() === false) {
          return { ok: false, refusal: WITHDRAWN }
        }
        const blocked = await conversationCommandBlocked(
          ctx,
          store.getRecord(sessionId)!,
          childWork(),
          context.sessions.get(sessionId)?.child ? undefined : 'at-rest'
        )
        if (blocked) {
          return { ok: false, refusal: blocked }
        }
        // A finished task's result reaches the lead only on its wake-up (R8.1), within the grace the
        // deferred continue gives it before carrying the result itself (R10.1).
        const wakeUpDue = context.sessions.get(sessionId)?.child
          ? brzaWakeUpDueAt(
              await readContextStructuredAgentSessionWork(ctx, { kind: 'child-work' }),
              context.readChildWork(sessionId)
            )
          : null
        if (wakeUpDue !== null && context.now() < wakeUpDue) {
          return { ok: false, refusal: WAKE_UP_OWED }
        }
        // The account first: one that cannot take the chat leaves its agent running (R6).
        const prepared = await ctx.adapter.prepareAccountSwitch?.({
          record: store.getRecord(sessionId)!,
          accountId
        })
        if (!prepared?.ok) {
          const failure = claudeAccountPinRefusal(prepared?.reason ?? 'unknown-account')
          return {
            ok: false,
            refusal: refuse('agent_session_operation_invalid', failure.details, failure.message)
          }
        }
        // No process may outlive the switch on the account it is leaving.
        await context.stopAgent(sessionId, { cause: 'evict', resting: true })
        const stopped = store.getRecord(sessionId)!
        const fence = stopped.lease.runtimeFence
        const rechecked = await conversationCommandBlocked(
          { ...ctx, fence },
          stopped,
          childWork(),
          'at-rest'
        )
        if (rechecked) {
          return { ok: false, refusal: rechecked }
        }
        const value = { accountId, account: prepared.account }
        change = {
          sessionId,
          fence,
          accountHome: prepared.accountHome,
          accountSwitch: {
            ...value,
            operationId: clientOperationId,
            callerKey: caller.callerKey,
            switchedAt: context.now()
          }
        }
        if (!ctx.operationReceipt) {
          throw new Error('agent_session_account_switch_receipt_missing')
        }
        // The "Account switched" divider sets no floor: the conversation goes on, in the other account.
        await ctx.journal.write(
          {
            kind: 'item',
            identity: { provider: 'orca', clientMessageId: `account-switch:${clientOperationId}` },
            body: {
              kind: 'status',
              text: agentSessionAccountSwitchedText(value.account),
              presentation: AGENT_SESSION_ACCOUNT_SWITCHED_PRESENTATION,
              accountSwitch: value
            },
            options: { fence, turnScope: { kind: 'thread' } }
          },
          () => ({ receipt: ctx.operationReceipt })
        )
        return { ok: true, value }
      }
    }
  })
}
