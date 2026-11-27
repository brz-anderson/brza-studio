import { afterEach, expect, it, vi } from 'vitest'
import type { AgentChildWorkView } from '../../../../../shared/agent-status/child-work/agent-status-child-work-view'
import { structuredAgentSessionMessageSendMutation } from '../../../../../shared/agent-session/requests/structured-agent-session-send-mutation'
import { BRZA_CONTINUE_AFTER_WORK_TIMEOUT_MS } from '../../brza/brza-deferred-usage-limit-continue'
import { childRecord } from '../../recovery/testing/structured-agent-session-restart-resume.test-fixture'
import { QUEUED_RIG_CALLER } from './structured-agent-session-queued-message-rig.test-fixture'
import {
  HOST_TEST_NOW as NOW,
  HOST_TEST_SESSION as SESSION,
  hostTestMessage,
  hostTestOperationId
} from './structured-agent-session-host-test-data.test-fixture'
import { eventually } from './structured-agent-session-queued-message-rig-provider.test-fixture'
import {
  accountHome as home,
  limitedChatWithBackgroundWork
} from './structured-agent-session-account-switch.brza.test-fixture'

let dispose: (() => Promise<void>) | undefined
afterEach(async () => dispose?.())

const settled = () => [
  childRecord({ id: 'task-a', kind: 'command', state: 'done', settledAt: NOW + 60_000 })
]

/** Limited on A with `work`, switched to B, and continued in another account. `beforeArm` runs
 *  right before the request, as a clock that has to start there. */
async function waiting(
  work: AgentChildWorkView[] = settled(),
  options: Parameters<typeof limitedChatWithBackgroundWork>[1] & { beforeArm?: () => void } = {}
) {
  const { beforeArm, ...rest } = options
  const chat = await limitedChatWithBackgroundWork(work, rest)
  dispose = chat.rig.dispose
  await chat.select('/homes/b')
  const sends = vi.spyOn(chat.rig.host, 'send')
  beforeArm?.()
  expect(await chat.arm()).toEqual({ kind: 'deferred' })
  const ours = (index: number) =>
    sends.mock.calls[index]![0].callerKey === 'trusted-local:brza-continue-after-work'
  const deferredSends = () => sends.mock.calls.filter((_call, index) => ours(index))
  const deferredResults = () =>
    sends.mock.results.filter((_result, index) => ours(index)).map((result) => result.value)
  /** Every continuation sent, the automatic one's included, with its answer. */
  const continuations = () =>
    Promise.all(
      sends.mock.calls.flatMap(([, params], index) =>
        params.usageLimitContinuationOfTurnItemId ? [sends.mock.results[index]!.value] : []
      )
    )
  return {
    ...chat,
    deferredSends,
    deferredResults,
    continuations,
    state: () => chat.deferred().readState(SESSION)
  }
}

it('waits while the background work is open, then continues on the chosen account', async () => {
  let open = true
  const work: AgentChildWorkView[] = []
  const chat = await waiting(work, { open: () => open })
  await chat.deferred().tick()
  expect(chat.child()?.accountHome).toEqual(home('/homes/a'))
  expect(chat.state()).toMatchObject({ account: 'Conta B', since: NOW })
  await eventually(() =>
    expect(chat.rig.host.readStatusSummary(SESSION)?.brzaContinueAfterWork).toEqual(chat.state())
  )
  open = false
  work.push(...settled())
  await chat.limit('wake-up', NOW + 60_001)
  await chat.deferred().tick()
  await eventually(() => expect(chat.child()?.accountHome).toEqual(home('/homes/b')))
  expect(chat.state()).toBeUndefined()
})

it('continues now when nothing holds the agent on the old account', async () => {
  const chat = await limitedChatWithBackgroundWork([])
  dispose = chat.rig.dispose
  await chat.select('/homes/b')
  expect(await chat.arm()).toEqual({ kind: 'now' })
  expect(chat.deferred().readState(SESSION)).toBeUndefined()
})

it.each([
  [
    'the row Cancel',
    (chat: Awaited<ReturnType<typeof waiting>>) => chat.deferred().cancel(SESSION)
  ],
  ['a Stop', (chat: Awaited<ReturnType<typeof waiting>>) => chat.rig.stop()],
  [
    'the selection going back',
    (chat: Awaited<ReturnType<typeof waiting>>) => chat.select('/homes/a')
  ]
])('drops the wait on %s and sends nothing', async (_name, drop) => {
  const chat = await waiting()
  await drop(chat)
  await chat.limit('wake-up', NOW + 60_001)
  await chat.deferred().tick()
  expect(chat.state()).toBeUndefined()
  expect(chat.deferredSends()).toHaveLength(0)
})

it('drops the wait when the chat closes', async () => {
  const chat = await waiting()
  await chat.rig.host.close(SESSION, 'user-close')
  await chat.limit('wake-up', NOW + 60_001).catch(() => undefined)
  await chat.deferred().tick()
  expect(chat.deferredSends()).toHaveLength(0)
})

it('drops the wait quietly when the wake-up goes through on the old account', async () => {
  const chat = await waiting()
  await chat.succeed('wake-up', NOW + 60_001)
  await chat.deferred().tick()
  expect(chat.state()).toBeUndefined()
  expect(chat.deferredSends()).toHaveLength(0)
  expect(chat.child()?.accountHome).toEqual(home('/homes/a'))
})

// A wake-up's turn row and its limit row land apart: a check between them must not end the wait.
it('keeps waiting for the limit row of a wake-up whose turn already failed', async () => {
  const chat = await waiting()
  await chat.fail('wake-up', NOW + 60_001)
  await chat.deferred().tick()
  expect(chat.state()).toMatchObject({ account: 'Conta B' })
  expect(chat.deferredSends()).toHaveLength(0)
  await chat.limitRow('wake-up', NOW + 60_001)
  await eventually(() => expect(chat.child()?.accountHome).toEqual(home('/homes/b')))
})

it('sends once when the automatic continue reached the newer cut first', async () => {
  const chat = await waiting()
  // Held until the automatic continue is in, so it does reach the cut first.
  const release = chat.deferred().pause(SESSION)
  const cut = await chat.limit('wake-up', NOW + 60_001)
  const automatic = await chat.rig.host.send(
    { callerKey: 'trusted-local:usage-limit-continue' },
    structuredAgentSessionMessageSendMutation({
      sessionId: SESSION,
      clientOperationId: hostTestOperationId(),
      expectedRuntimeFence: chat.rig.store.getConversation(SESSION)!.currentFence,
      body: hostTestMessage('Continue where you left off.'),
      usageLimitContinuationOfTurnItemId: cut
    })
  )
  expect(automatic).toMatchObject({ ok: true })
  release()
  await chat.deferred().tick()
  // The request saw the automatic continue: it ended without a send, or its send was superseded.
  expect(chat.state()).toBeUndefined()
  for (const result of await Promise.all(chat.deferredResults())) {
    expect(result).toMatchObject({ refusal: { details: { reason: 'continuationSuperseded' } } })
  }
  expect((await chat.continuations()).filter((result) => result.ok)).toHaveLength(1)
  await eventually(() => expect(chat.child()?.accountHome).toEqual(home('/homes/b')))
})

it('keeps no wait across a restart of the app', async () => {
  const chat = await waiting()
  const before = chat.rig.host
  chat.rig.crashRestartHostProcess()
  before.brzaContinueAfterWork.dispose()
  expect(chat.rig.host.brzaContinueAfterWork.readState(SESSION)).toBeUndefined()
  expect(await chat.arm()).toEqual({ kind: 'now' })
})

it('gives up after 30 minutes, says so, and never sends', async () => {
  const chat = await waiting()
  chat.advance(BRZA_CONTINUE_AFTER_WORK_TIMEOUT_MS)
  await chat.deferred().tick()
  expect(chat.state()).toMatchObject({ account: 'Conta B', expired: true })
  await chat.limit('wake-up', NOW + 60_001)
  await chat.deferred().tick()
  expect(chat.deferredSends()).toHaveLength(0)
  await chat.deferred().cancel(SESSION)
  expect(chat.state()).toBeUndefined()
})

it('carries the task in the continue when its wake-up never starts, at its 30 s deadline', async () => {
  // The host's clock runs with real time from 300 ms before the task's grace ends, so only the
  // deadline's own timer can send the continue: no check is called here.
  // ast-grep-ignore: test-no-wall-clock -- the host's clock must run with real time so that only the deadline's real timer fires; fake timers would also stop the rig's own
  const realTime = () => Date.now()
  let armedAt: number | undefined
  const clock = () => (armedAt === undefined ? NOW : NOW + 89_700 + (realTime() - armedAt))
  const chat = await waiting(
    [
      childRecord({
        id: 'task-a',
        kind: 'command',
        state: 'done',
        settledAt: NOW + 60_000,
        description: 'Run the suite'
      })
    ],
    { clock, beforeArm: () => (armedAt = realTime()) }
  )
  expect(chat.deferredSends()).toHaveLength(0)
  await eventually(() => expect(chat.child()?.accountHome).toEqual(home('/homes/b')))
  const [[, params]] = chat.deferredSends()
  const text = params.body.blocks.map((block) => ('text' in block ? block.text : '')).join('\n')
  expect(text).toContain('<task-notification>')
  expect(text).toContain('<summary>Run the suite</summary>')
  expect(params.usageLimitContinuationOfTurnItemId).toBe(chat.turnItemId)
})

// R9.1: only the chat's own Stop, once the host took it, ends the wait.
it.each([
  [
    "a task's Stop on the strip",
    (chat: Awaited<ReturnType<typeof waiting>>) => {
      const fields = {
        turnId: 'background-tasks',
        scope: 'background-tasks',
        taskId: 'task-a'
      } as const
      return chat.rig.host.cancel(QUEUED_RIG_CALLER, {
        envelope: chat.rig.envelope(fields, 'agentSession.cancel', hostTestOperationId()),
        ...fields
      })
    }
  ],
  [
    "a question card's cancel",
    (chat: Awaited<ReturnType<typeof waiting>>) => {
      const fields = { prompt: { itemId: 'question', expectedRevision: 1 } }
      return chat.rig.host.cancel(QUEUED_RIG_CALLER, {
        envelope: chat.rig.envelope(fields, 'agentSession.cancel', hostTestOperationId()),
        ...fields
      })
    }
  ],
  [
    'a Stop the host refused',
    async (chat: Awaited<ReturnType<typeof waiting>>) => {
      const envelope = chat.rig.envelope({}, 'agentSession.cancel', hostTestOperationId())
      const refused = await chat.rig.host.cancel(QUEUED_RIG_CALLER, {
        envelope: { ...envelope, payloadFingerprint: '0'.repeat(64) }
      })
      expect(refused).toMatchObject({ ok: false })
    }
  ]
])('keeps the wait on %s', async (_name, cancel) => {
  const chat = await waiting()
  await cancel(chat)
  await chat.deferred().tick()
  expect(chat.state()).toMatchObject({ account: 'Conta B' })
  expect(chat.state()?.expired).toBeUndefined()
})

// R9.2: applying the selection checks the wait again, with no publish of the chat's own.
it('takes the line down as soon as the selection goes back, with no check called', async () => {
  const chat = await waiting([], { open: () => true })
  await chat.select('/homes/a')
  expect(chat.state()).toBeUndefined()
  expect(chat.deferredSends()).toHaveLength(0)
})

// A1: a wake-up that failed for another reason than the limit never brings a cut.
it('ends the wait saying so when the wake-up failed without a usage limit', async () => {
  const chat = await waiting()
  await chat.fail('wake-up', NOW + 60_001)
  await chat.deferred().tick()
  expect(chat.state()?.expired).toBeUndefined()
  chat.advance(2_000)
  await chat.deferred().tick()
  expect(chat.state()).toMatchObject({ account: 'Conta B', expired: true, reason: 'turnFailed' })
  expect(chat.deferredSends()).toHaveLength(0)
})

// The grace belongs to the failed turn: a later failed turn waits for its own limit row anew.
it('gives each failed turn its own grace before ending the wait', async () => {
  const chat = await waiting()
  await chat.fail('wake-up', NOW + 60_001)
  await chat.deferred().tick()
  chat.advance(2_000)
  await chat.fail('answer', NOW + 60_002)
  await chat.deferred().tick()
  expect(chat.state()?.expired).toBeUndefined()
  await chat.limitRow('answer', NOW + 60_002)
  await eventually(() => expect(chat.child()?.accountHome).toEqual(home('/homes/b')))
})

it('keeps waiting when the person sends a new message meanwhile', async () => {
  const chat = await waiting()
  const { id, result } = chat.rig.send('one more thing', undefined, { fence: 1 })
  await result
  await chat.rig.settleAccepted(id, 'two')
  await chat.deferred().tick()
  expect(chat.state()).toMatchObject({ account: 'Conta B' })
  await chat.limit('wake-up', NOW + 60_001)
  await chat.deferred().tick()
  await eventually(() => expect(chat.child()?.accountHome).toEqual(home('/homes/b')))
})
