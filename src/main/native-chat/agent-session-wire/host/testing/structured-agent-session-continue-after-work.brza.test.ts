import { afterEach, expect, it, vi } from 'vitest'
import type { AgentChildWorkView } from '../../../../../shared/agent-status/child-work/agent-status-child-work-view'
import { structuredAgentSessionMessageSendMutation } from '../../../../../shared/agent-session/requests/structured-agent-session-send-mutation'
import { BRZA_CONTINUE_AFTER_WORK_TIMEOUT_MS } from '../../brza/brza-deferred-usage-limit-continue'
import { childRecord } from '../../recovery/testing/structured-agent-session-restart-resume.test-fixture'
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

/** Limited on A with `work`, switched to B, and continued in another account. */
async function waiting(work: AgentChildWorkView[] = settled(), open?: () => boolean) {
  const chat = await limitedChatWithBackgroundWork(work, open ? { open } : {})
  dispose = chat.rig.dispose
  await chat.select('/homes/b')
  const sends = vi.spyOn(chat.rig.host, 'send')
  expect(await chat.arm()).toEqual({ kind: 'deferred' })
  const ours = (index: number) =>
    sends.mock.calls[index]![0].callerKey === 'trusted-local:brza-continue-after-work'
  const deferredSends = () => sends.mock.calls.filter((_call, index) => ours(index))
  const deferredResults = () =>
    sends.mock.results.filter((_result, index) => ours(index)).map((result) => result.value)
  return {
    ...chat,
    deferredSends,
    deferredResults,
    state: () => chat.deferred().readState(SESSION)
  }
}

it('waits while the background work is open, then continues on the chosen account', async () => {
  let open = true
  const work: AgentChildWorkView[] = []
  const chat = await waiting(work, () => open)
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
  await chat.deferred().tick()
  // Either the agent already moved and the wait ends, or the deferred send is refused as superseded.
  const accepted = await Promise.all(chat.deferredResults())
  expect(accepted.filter((result) => result.ok)).toHaveLength(0)
  expect(chat.state()).toBeUndefined()
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

it('carries the task in the continue when its wake-up never starts', async () => {
  const chat = await waiting([
    childRecord({
      id: 'task-a',
      kind: 'command',
      state: 'done',
      settledAt: NOW + 60_000,
      description: 'Run the suite'
    })
  ])
  chat.advance(90_000)
  await chat.deferred().tick()
  await eventually(() => expect(chat.child()?.accountHome).toEqual(home('/homes/b')))
  const [[, params]] = chat.deferredSends()
  const text = params.body.blocks.map((block) => ('text' in block ? block.text : '')).join('\n')
  expect(text).toContain('<task-notification>')
  expect(text).toContain('<summary>Run the suite</summary>')
  expect(params.usageLimitContinuationOfTurnItemId).toBe(chat.turnItemId)
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
