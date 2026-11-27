import { afterEach, expect, it } from 'vitest'
import { childRecord } from '../../recovery/testing/structured-agent-session-restart-resume.test-fixture'
import { HOST_TEST_NOW as NOW } from './structured-agent-session-host-test-data.test-fixture'
import { eventually } from './structured-agent-session-queued-message-rig-provider.test-fixture'
import {
  accountHome as home,
  limitedChatWithBackgroundWork
} from './structured-agent-session-account-switch.brza.test-fixture'

let dispose: (() => Promise<void>) | undefined
afterEach(async () => dispose?.())

// Anderson's report (2026-11-26): the chat followed the selection, a background task was open when
// the limit hit, and after choosing the other account it answered and hit the limit again.
it('continues on the chosen account once the finished task has had its wake-up', async () => {
  const chat = await limitedChatWithBackgroundWork([
    childRecord({ id: 'task-a', kind: 'command', state: 'done', settledAt: NOW + 60_000 })
  ])
  dispose = chat.rig.dispose
  await chat.select('/homes/b')
  expect(await chat.arm()).toEqual({ kind: 'deferred' })
  await chat.deferred().tick()
  expect(chat.child()?.accountHome).toEqual(home('/homes/a'))
  // The wake-up runs on A, which is still out of usage, and leaves a newer cut; its status publish
  // is what sends the continue, with no tick.
  await chat.limit('wake-up', NOW + 60_001)
  await eventually(() => expect(chat.child()?.accountHome).toEqual(home('/homes/b')))
})
