import { afterEach, expect, it } from 'vitest'
import type { AgentChildWorkView } from '../../../../../shared/agent-status/child-work/agent-status-child-work-view'
import { agentSessionFailureFact } from '../../../../../shared/agent-session/failures/agent-session-failure'
import { agentSessionFailureWords } from '../../../../../shared/agent-session/failures/agent-session-failure-words'
import { agentJournalItemKey } from '../../../../../shared/agent-session/journal/agent-session-journal-item-key'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import { computeAgentSessionPayloadFingerprint } from '../../../../../shared/agent-session/lifecycle/operations/agent-session-mutation-envelope'
import { readTestHostJournal } from '../../../agent-session-journal/journal-observation.test-support'
import { childRecord } from '../../recovery/testing/structured-agent-session-restart-resume.test-fixture'
import {
  HOST_TEST_NOW as NOW,
  HOST_TEST_SESSION as SESSION,
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
const accountHome = (accountId: string | null) => home(`/homes/${accountId ?? 'default'}`)
const TASK = { idKind: 'task_id' as const, id: 'task-a' }
const SETTLED_AT = NOW + 60_000
/** An account the switch cannot ready, as one removed meanwhile. */
const GONE = 'gone'

function switchAccount(current: QueuedMessageTestRig, accountId: string) {
  return current.host.conversationCommands.switchAccount(QUEUED_RIG_CALLER, {
    accountId,
    envelope: {
      sessionId: SESSION,
      clientOperationId: hostTestOperationId(),
      expectedRuntimeFence: current.store.getRecord(SESSION)!.lease.runtimeFence,
      payloadFingerprint: computeAgentSessionPayloadFingerprint({
        method: 'agentSession.switchAccount',
        sessionId: SESSION,
        fields: { accountId }
      })
    }
  })
}

async function dividers(current: QueuedMessageTestRig): Promise<string[]> {
  return (await readTestHostJournal(current.host, SESSION)).items.flatMap((item) =>
    item.body.kind === 'status' && item.body.presentation === 'account-switched'
      ? [item.body.text]
      : []
  )
}

/** A Claude chat pinned to account A (P36), its last turn ended by A's usage limit. */
async function pinnedLimitedChat() {
  let work: AgentChildWorkView[] = []
  let pinned: () => string | null = () => null
  const current = await createQueuedMessageTestRig({
    agent: 'claude',
    restartable: true,
    acquiredAccountHome: () => accountHome(pinned()),
    hostDeps: {
      statusSink: { publish: () => {}, forget: () => {}, readChildWork: () => work }
    }
  })
  rig = current
  pinned = () => current.store.getRecord(SESSION)?.accountSwitch?.accountId ?? null
  // A pinned chat launches on its pin whatever the selection.
  current.host.deps.launchAccountHome = async (record) =>
    accountHome(record.accountSwitch?.accountId ?? null)
  Object.assign(current.host.deps.adapter, {
    prepareAccountSwitch: async ({ accountId }: { accountId: string | null }) =>
      accountId === GONE
        ? { ok: false, reason: 'unknown-account' }
        : { ok: true, accountHome: accountHome(accountId), account: `${accountId}@example.com` }
  })
  expect(await switchAccount(current, 'a')).toMatchObject({ ok: true })
  await current.settleAccepted(await current.workingSend(), 'one')
  await eventually(() =>
    expect(current.host.collaboratorsForTests().conversationDelivery.loop.isRunning(SESSION)).toBe(
      false
    )
  )
  const session = () => current.host.collaboratorsForTests().sessions.get(SESSION)
  expect(session()?.child?.accountHome).toEqual(accountHome('a'))
  /** A turn on A that its usage limit ended at `at`; returns its cut's id. */
  const limit = async (id: string, at: number): Promise<string> => {
    const fence = current.store.getConversation(SESSION)!.currentFence
    const turnItemId = agentJournalItemKey({ provider: 'orca', clientMessageId: id })
    await session()!.journal.appendItem(
      { provider: 'orca', clientMessageId: id },
      {
        kind: 'turn',
        turnId: id,
        providerTurnId: id,
        state: 'completed',
        outcome: 'failure',
        startedAt: at,
        completedAt: at
      },
      { fence, turnScope: AGENT_JOURNAL_THREAD_SCOPE }
    )
    await session()!.journal.appendItem(
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
      { fence, turnScope: { kind: 'turn', turnItemId } }
    )
    return turnItemId
  }
  const turnItemId = await limit('limited', NOW + 1)
  const deferred = () => current.host.brzaContinueAfterWork
  return {
    rig: current,
    deferred,
    child: () => session()?.child,
    state: () => deferred().readState(SESSION),
    /** "Continue in another account" on the pinned chat's limit row (PLN-026, D5). */
    continueIn: (accountId: string) =>
      deferred().arm({
        sessionId: SESSION,
        turnItemId,
        target: 'pin',
        accountId,
        account: `Conta ${accountId}`
      }),
    /** The provider reports the task running in the background. */
    openTask: () => {
      work = [childRecord({ id: TASK.id, kind: 'command' })]
      current.host.publishChildWorkEvidence(SESSION, [
        {
          type: 'live',
          observedAt: NOW + 2,
          child: {
            handle: TASK,
            kind: 'command',
            residency: 'background',
            state: 'working',
            stoppable: true
          }
        }
      ])
    },
    /** The task ended after the limit; the lead owes it a wake-up. */
    finishTask: () => {
      work = [childRecord({ id: TASK.id, kind: 'command', state: 'done', settledAt: SETTLED_AT })]
      current.host.publishChildWorkEvidence(SESSION, [
        { type: 'ended', observedAt: SETTLED_AT, handle: TASK, outcome: 'succeeded' }
      ])
    },
    /** The CLI wakes the lead on A for the finished task, and A's limit ends that turn too. */
    wakeUpHitsLimit: () => limit('wake-up', SETTLED_AT + 1)
  }
}

it('continues a pinned chat on the chosen account once its open background task ends', async () => {
  const chat = await pinnedLimitedChat()
  chat.openTask()
  const onA = chat.child()
  const closes = chat.rig.closeSession.mock.calls.length
  expect(await chat.continueIn('b')).toEqual({ kind: 'deferred' })
  await chat.deferred().tick()
  // The task runs on A's agent: nothing moves while it does.
  expect(chat.child()).toBe(onA)
  expect(chat.rig.closeSession.mock.calls.length).toBe(closes)
  expect(chat.state()).toMatchObject({ account: 'Conta b' })
  chat.finishTask()
  // The wake-up's status publish runs the switch: no check is called here.
  await chat.wakeUpHitsLimit()
  await eventually(() => expect(chat.child()?.accountHome).toEqual(accountHome('b')))
  expect(chat.rig.store.getRecord(SESSION)?.accountSwitch).toMatchObject({ accountId: 'b' })
  expect((await dividers(chat.rig)).at(-1)).toBe('Account switched - b@example.com')
  expect(chat.state()).toBeUndefined()
})

it('keeps a pinned chat on its account until the lead wakes up for a finished task', async () => {
  const chat = await pinnedLimitedChat()
  chat.finishTask()
  const onA = chat.child()
  const closes = chat.rig.closeSession.mock.calls.length
  expect(await chat.continueIn('b')).toEqual({ kind: 'deferred' })
  await chat.deferred().tick()
  // A's agent owes its lead the wake-up that hands it the task's result.
  expect(chat.child()).toBe(onA)
  expect(chat.rig.closeSession.mock.calls.length).toBe(closes)
  const dispatches = chat.rig.dispatch.mock.calls.length
  await chat.wakeUpHitsLimit()
  await eventually(() => expect(chat.child()?.accountHome).toEqual(accountHome('b')))
  await eventually(() => expect(chat.rig.dispatch.mock.calls.length).toBe(dispatches + 1))
  expect(chat.rig.store.getRecord(SESSION)?.accountSwitch).toMatchObject({ accountId: 'b' })
})

// R8.1: the composer's picker would stop the agent before it wakes, and the result would be lost.
it('refuses to switch a chat whose lead still owes a finished task its wake-up', async () => {
  const chat = await pinnedLimitedChat()
  chat.finishTask()
  const onA = chat.child()
  expect(await switchAccount(chat.rig, 'b')).toMatchObject({
    ok: false,
    refusal: {
      message: 'Wait for background tasks to finish before using this command.',
      details: { reason: 'backgroundTasksRunning' }
    }
  })
  expect(chat.child()).toBe(onA)
  expect(chat.rig.store.getRecord(SESSION)?.accountSwitch).toMatchObject({ accountId: 'a' })
})

// R8.2: an account that cannot take the chat ends the wait, and the row says so.
it('ends the wait when the chosen account cannot take the chat once the work is done', async () => {
  const chat = await pinnedLimitedChat()
  chat.finishTask()
  expect(await chat.continueIn(GONE)).toEqual({ kind: 'deferred' })
  await chat.wakeUpHitsLimit()
  await chat.deferred().tick()
  // On the wake-up's newer cut, the row it shows on, so no later cut's row says it.
  expect(chat.state()).toMatchObject({
    expired: true,
    reason: 'accountUnavailable',
    turnItemId: agentJournalItemKey({ provider: 'orca', clientMessageId: 'wake-up' })
  })
  // The switch's refusal leaves the chat on its pin, its agent stopped at rest as before.
  expect(chat.rig.store.getRecord(SESSION)?.accountSwitch).toMatchObject({ accountId: 'a' })
})
