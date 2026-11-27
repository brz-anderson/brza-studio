import { afterEach, expect, it, vi, type MockInstance } from 'vitest'
import type { AgentChildWorkView } from '../../../../../shared/agent-status/child-work/agent-status-child-work-view'
import { agentSessionFailureFact } from '../../../../../shared/agent-session/failures/agent-session-failure'
import { agentSessionFailureWords } from '../../../../../shared/agent-session/failures/agent-session-failure-words'
import { agentJournalItemKey } from '../../../../../shared/agent-session/journal/agent-session-journal-item-key'
import { AGENT_JOURNAL_THREAD_SCOPE } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import { computeAgentSessionPayloadFingerprint } from '../../../../../shared/agent-session/lifecycle/operations/agent-session-mutation-envelope'
import { refuse } from '../../../../../shared/agent-session/failures/agent-session-wire-refusals'
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
/** When the lead's wake-up for the task is overdue: the deferred continue carries the result. */
const WAKE_UP_DUE = SETTLED_AT + 30_000
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
  let now = NOW
  const current = await createQueuedMessageTestRig({
    agent: 'claude',
    restartable: true,
    now: () => now,
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
    pin: () => current.store.getRecord(SESSION)?.accountSwitch?.accountId,
    advanceTo: (at: number) => {
      now = at
    },
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
  expect(chat.pin()).toBe('a')
  // R10.1: past the grace the deferred continue gives the wake-up, the picker switches.
  chat.advanceTo(WAKE_UP_DUE)
  expect(await switchAccount(chat.rig, 'b')).toMatchObject({ ok: true })
  expect(chat.pin()).toBe('b')
})

// R8.2: an account that cannot take the chat ends the wait, and the row says so.
it('ends the wait when the chosen account cannot take the chat once the work is done', async () => {
  const chat = await pinnedLimitedChat()
  chat.finishTask()
  const onA = chat.child()
  expect(await chat.continueIn(GONE)).toEqual({ kind: 'deferred' })
  await chat.wakeUpHitsLimit()
  await chat.deferred().tick()
  // On the wake-up's newer cut, the row it shows on, so no later cut's row says it.
  expect(chat.state()).toMatchObject({
    expired: true,
    reason: 'accountUnavailable',
    turnItemId: agentJournalItemKey({ provider: 'orca', clientMessageId: 'wake-up' })
  })
  // R6: the account is readied before the agent stops, so the refusal leaves both in place.
  expect(chat.pin()).toBe('a')
  expect(chat.child()).toBe(onA)
})

// B1: a Cancel that reaches the chat's lane before the switch keeps the chat where it is.
it('keeps the chat and its agent when the Cancel comes in while the switch is decided', async () => {
  const chat = await pinnedLimitedChat()
  chat.finishTask()
  const onA = chat.child()
  const closes = chat.rig.closeSession.mock.calls.length
  expect(await chat.continueIn('b')).toEqual({ kind: 'deferred' })
  const delivery = chat.rig.host.collaboratorsForTests().clientDelivery
  const readCut = delivery.readUsageLimitCut
  // The row's Cancel lands in the chat's lane while the check reads the cut to fire.
  delivery.readUsageLimitCut = async (id) => {
    delivery.readUsageLimitCut = readCut
    void chat.deferred().cancel(SESSION)
    return readCut(id)
  }
  await chat.wakeUpHitsLimit()
  await chat.deferred().tick()
  await eventually(() => expect(chat.state()).toBeUndefined())
  expect(chat.pin()).toBe('a')
  expect(chat.child()).toBe(onA)
  expect(chat.rig.closeSession.mock.calls.length).toBe(closes)
})

// R8.2 and R5: a switch that did not happen tries again on a later check, no sooner than 2 s.
it.each([
  [
    'a refusal that waits',
    (switches: MockInstance) =>
      switches.mockResolvedValueOnce({
        ok: false,
        refusal: refuse('agent_session_operation_invalid', { reason: 'turnActive' }, 'Busy.')
      })
  ],
  [
    'a switch that throws',
    (switches: MockInstance) => switches.mockRejectedValueOnce(new Error('copy'))
  ]
])('tries the switch again after %s', async (_name, once) => {
  const chat = await pinnedLimitedChat()
  chat.finishTask()
  expect(await chat.continueIn('b')).toEqual({ kind: 'deferred' })
  const switches = vi.spyOn(chat.rig.host.conversationCommands, 'switchAccount')
  once(switches)
  vi.spyOn(chat.rig.host.deps.logger, 'warn').mockImplementation(() => {})
  await chat.wakeUpHitsLimit()
  await eventually(() => expect(switches).toHaveBeenCalledTimes(1))
  await chat.deferred().tick()
  expect(switches).toHaveBeenCalledTimes(1)
  expect(chat.state()).toMatchObject({ account: 'Conta b' })
  expect(chat.state()?.expired).toBeUndefined()
  chat.advanceTo(NOW + 2_000)
  await chat.deferred().tick()
  await eventually(() => expect(chat.child()?.accountHome).toEqual(accountHome('b')))
  expect(switches).toHaveBeenCalledTimes(2)
})

it('drops the wait when the composer moves the pin meanwhile', async () => {
  const chat = await pinnedLimitedChat()
  chat.finishTask()
  expect(await chat.continueIn('b')).toEqual({ kind: 'deferred' })
  // Past the wake-up's grace, as R10.1 lets the picker switch.
  chat.advanceTo(WAKE_UP_DUE)
  expect(await switchAccount(chat.rig, 'c')).toMatchObject({ ok: true })
  await chat.deferred().tick()
  await eventually(() => expect(chat.state()).toBeUndefined())
  expect(chat.pin()).toBe('c')
})

it("drops the wait on the chat's Stop and keeps the pin", async () => {
  const chat = await pinnedLimitedChat()
  chat.openTask()
  expect(await chat.continueIn('b')).toEqual({ kind: 'deferred' })
  const stop = chat.rig.envelope({}, 'agentSession.cancel', hostTestOperationId())
  const envelope = {
    ...stop,
    expectedRuntimeFence: chat.rig.store.getRecord(SESSION)!.lease.runtimeFence
  }
  expect(await chat.rig.host.cancel(QUEUED_RIG_CALLER, { envelope })).toMatchObject({ ok: true })
  await eventually(() => expect(chat.state()).toBeUndefined())
  expect(chat.pin()).toBe('a')
})

// The fallback: the wake-up never came, so the continue on the new account carries the result.
it("carries the task's result through the switch when the wake-up never comes", async () => {
  const chat = await pinnedLimitedChat()
  chat.finishTask()
  const sends = vi.spyOn(chat.rig.host, 'send')
  expect(await chat.continueIn('b')).toEqual({ kind: 'deferred' })
  chat.advanceTo(WAKE_UP_DUE)
  await chat.deferred().tick()
  await eventually(() => expect(chat.child()?.accountHome).toEqual(accountHome('b')))
  const ours = sends.mock.calls.filter(
    ([caller]) => caller.callerKey === 'trusted-local:brza-continue-after-work'
  )
  expect(ours).toHaveLength(1)
  const text = ours[0]![1].body.blocks.map((block) => ('text' in block ? block.text : ''))
  expect(text.join('\n')).toContain('<task-notification>')
  expect(chat.pin()).toBe('b')
})

// R6: with the account refused, the agent stays, and its wake-up can still hand it the result.
it("keeps the agent and the task's result when the account cannot take the chat at the fallback", async () => {
  const chat = await pinnedLimitedChat()
  chat.finishTask()
  const onA = chat.child()
  expect(await chat.continueIn(GONE)).toEqual({ kind: 'deferred' })
  chat.advanceTo(WAKE_UP_DUE)
  await chat.deferred().tick()
  expect(chat.state()).toMatchObject({ expired: true, reason: 'accountUnavailable' })
  expect(chat.child()).toBe(onA)
  expect(chat.child()?.close).toBeUndefined()
})
