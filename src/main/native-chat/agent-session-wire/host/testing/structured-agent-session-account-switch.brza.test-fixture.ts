import type { AgentChildWorkView } from '../../../../../shared/agent-status/child-work/agent-status-child-work-view'
import { agentSessionFailureFact } from '../../../../../shared/agent-session/failures/agent-session-failure'
import { agentSessionFailureWords } from '../../../../../shared/agent-session/failures/agent-session-failure-words'
import { agentJournalItemKey } from '../../../../../shared/agent-session/journal/agent-session-journal-item-key'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import { expect } from 'vitest'
import { releaseIdleChatsOnOtherAccount } from '../structured-agent-session-account-switch'
import {
  HOST_TEST_NOW as NOW,
  HOST_TEST_SESSION as SESSION
} from './structured-agent-session-host-test-data.test-fixture'
import { createQueuedMessageTestRig } from './structured-agent-session-queued-message-rig.test-fixture'
import { eventually } from './structured-agent-session-queued-message-rig-provider.test-fixture'

export const accountHome = (path: string) => ({ variable: 'CLAUDE_CONFIG_DIR' as const, path })

/** A Claude chat that follows the selection, limited on account A with the given background work.
 *  `work` is read live, so a case can settle it later; `open` stands for work still running. */
export async function limitedChatWithBackgroundWork(
  work: AgentChildWorkView[],
  options: { open?: () => boolean } = {}
) {
  let selected = '/homes/a'
  let now = NOW
  const rig = await createQueuedMessageTestRig({
    agent: 'claude',
    restartable: true,
    now: () => now,
    acquiredAccountHome: () => accountHome(selected),
    hostDeps: {
      statusSink: { publish: () => {}, forget: () => {}, readChildWork: () => work },
      ...(options.open ? { hasOpenDispatch: options.open } : {})
    }
  })
  rig.host.deps.launchAccountHome = async () => accountHome(selected)
  await rig.settleAccepted(await rig.workingSend(), 'one')
  await eventually(() =>
    expect(rig.host.collaboratorsForTests().conversationDelivery.loop.isRunning(SESSION)).toBe(
      false
    )
  )
  const journal = () => rig.host.collaboratorsForTests().sessions.get(SESSION)!.journal
  const fence = () => rig.store.getConversation(SESSION)!.currentFence
  const turn = async (id: string, at: number, outcome: 'success' | 'failure') => {
    await journal().appendItem(
      { provider: 'orca', clientMessageId: id },
      {
        kind: 'turn',
        turnId: id,
        providerTurnId: id,
        state: 'completed',
        outcome,
        startedAt: at,
        completedAt: at
      },
      { fence: fence(), turnScope: AGENT_JOURNAL_THREAD_SCOPE }
    )
    return agentJournalItemKey({ provider: 'orca', clientMessageId: id })
  }
  /** A turn that ended on the usage limit at `at`, as the CLI writes it; returns its cut's id. */
  const limit = async (id: string, at: number): Promise<string> => {
    const turnItemId = await turn(id, at, 'failure')
    await journal().appendItem(
      { provider: 'orca', clientMessageId: `${id}-limit` },
      {
        kind: 'status',
        ...agentSessionFailureWords(
          agentSessionFailureFact('usageLimitReached', {
            usageLimit: { resetsAt: at + 3_600_000 }
          }),
          { surface: 'row' }
        )
      },
      { fence: fence(), turnScope: { kind: 'turn', turnItemId } }
    )
    return turnItemId
  }
  const turnItemId = await limit('limited', NOW + 1)
  const deferred = () => rig.host.brzaContinueAfterWork
  return {
    rig,
    turnItemId,
    limit,
    /** A wake-up that went through on the old account: the limit had reset. */
    succeed: (id: string, at: number) => turn(id, at, 'success'),
    deferred,
    child: () => rig.host.collaboratorsForTests().sessions.get(SESSION)?.child,
    /** Moves the selection to `path` and lets the switch release idle chats, as the picker does. */
    select: async (path: string) => {
      selected = path
      await releaseIdleChatsOnOtherAccount(rig.host, 'claude', () => true)
    },
    arm: (turn = turnItemId) =>
      deferred().arm({ sessionId: SESSION, turnItemId: turn, account: 'Conta B' }),
    advance: (ms: number) => {
      now += ms
    },
    now: () => now
  }
}
