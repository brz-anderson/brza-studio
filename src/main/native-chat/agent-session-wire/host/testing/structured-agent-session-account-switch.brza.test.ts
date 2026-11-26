import { afterEach, expect, it } from 'vitest'
import type { AgentChildWorkView } from '../../../../../shared/agent-status/child-work/agent-status-child-work-view'
import { agentSessionFailureFact } from '../../../../../shared/agent-session/failures/agent-session-failure'
import { agentSessionFailureWords } from '../../../../../shared/agent-session/failures/agent-session-failure-words'
import { agentJournalItemKey } from '../../../../../shared/agent-session/journal/agent-session-journal-item-key'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import { structuredAgentSessionMessageSendMutation } from '../../../../../shared/agent-session/requests/structured-agent-session-send-mutation'
import { releaseIdleChatsOnOtherAccount } from '../structured-agent-session-account-switch'
import { childRecord } from '../../recovery/testing/structured-agent-session-restart-resume.test-fixture'
import {
  HOST_TEST_NOW as NOW,
  HOST_TEST_SESSION as SESSION,
  hostTestMessage,
  hostTestOperationId
} from './structured-agent-session-host-test-data.test-fixture'
import {
  createQueuedMessageTestRig,
  QUEUED_RIG_CALLER,
  type QueuedMessageTestRig
} from './structured-agent-session-queued-message-rig.test-fixture'
import { eventually } from './structured-agent-session-queued-message-rig-provider.test-fixture'

let rig: QueuedMessageTestRig | undefined
afterEach(async () => rig?.dispose())

const home = (path: string) => ({ variable: 'CLAUDE_CONFIG_DIR' as const, path })

/** A Claude chat that follows the selection, limited on account A with background work open. */
async function limitedChatWithOpenTask(work: AgentChildWorkView[]) {
  let selected = '/homes/a'
  const current = await createQueuedMessageTestRig({
    agent: 'claude',
    restartable: true,
    acquiredAccountHome: () => home(selected),
    hostDeps: {
      statusSink: { publish: () => {}, forget: () => {}, readChildWork: () => work }
    }
  })
  rig = current
  current.host.deps.launchAccountHome = async () => home(selected)
  await current.settleAccepted(await current.workingSend(), 'one')
  await eventually(() =>
    expect(current.host.collaboratorsForTests().conversationDelivery.loop.isRunning(SESSION)).toBe(
      false
    )
  )
  const journal = current.host.collaboratorsForTests().sessions.get(SESSION)!.journal
  const turnItemId = agentJournalItemKey({ provider: 'orca', clientMessageId: 'limited' })
  await journal.appendItem(
    { provider: 'orca', clientMessageId: 'limited' },
    {
      kind: 'turn',
      turnId: 'limited',
      providerTurnId: 'limited',
      state: 'completed',
      outcome: 'failure',
      startedAt: NOW + 1,
      completedAt: NOW + 1
    },
    { fence: 1, turnScope: AGENT_JOURNAL_THREAD_SCOPE }
  )
  await journal.appendItem(
    { provider: 'orca', clientMessageId: 'limited-limit' },
    {
      kind: 'status',
      ...agentSessionFailureWords(
        agentSessionFailureFact('usageLimitReached', { usageLimit: { resetsAt: NOW + 60_000 } }),
        { surface: 'row' }
      )
    },
    { fence: 1, turnScope: { kind: 'turn', turnItemId } }
  )
  return {
    rig: current,
    turnItemId,
    child: () => current.host.collaboratorsForTests().sessions.get(SESSION)?.child,
    select: (path: string) => {
      selected = path
    }
  }
}

// Anderson's report (2026-11-26): the chat followed the selection, a background task was open when
// the limit hit, and after choosing the other account it answered and hit the limit again.
it.fails('continues on the chosen account with a finished background task awaiting its wake-up', async () => {
  const chat = await limitedChatWithOpenTask([
    childRecord({ id: 'task-a', kind: 'command', state: 'done', settledAt: NOW + 60_000 })
  ])
  chat.select('/homes/b')
  await releaseIdleChatsOnOtherAccount(chat.rig.host, 'claude', () => true)
  const fence = chat.rig.store.getConversation(SESSION)!.currentFence
  const sent = await chat.rig.host.send(
    QUEUED_RIG_CALLER,
    structuredAgentSessionMessageSendMutation({
      sessionId: SESSION,
      clientOperationId: hostTestOperationId(),
      expectedRuntimeFence: fence,
      body: hostTestMessage('Continue where you left off.'),
      usageLimitContinuationOfTurnItemId: chat.turnItemId
    })
  )
  expect(sent).toMatchObject({ ok: true })
  await eventually(() => expect(chat.child()?.accountHome).toEqual(home('/homes/b')))
})
