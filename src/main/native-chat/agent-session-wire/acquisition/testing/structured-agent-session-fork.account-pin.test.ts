import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { forkTestSource } from './structured-agent-session-fork.test-fixture'
import {
  createRestTestRig,
  type RestTestRig
} from '../../host/testing/structured-agent-session-rest-test-rig'
import { reserveRequestFor } from '../structured-agent-session-attach'
import { setStructuredAgentSessionHost } from '../../host/structured-agent-session-registry'

let rig: RestTestRig
beforeEach(async () => {
  rig = await createRestTestRig({ idleSweep: { intervalMs: 60_000 } })
})
afterEach(async () => {
  setStructuredAgentSessionHost(null)
  await rig.dispose()
  vi.restoreAllMocks()
})

it('opens the fork of a chat pinned to account B on B, whatever the selected account', async () => {
  const test = forkTestSource(rig, 'claude')
  test.record.accountSwitch = {
    accountId: 'account-b',
    account: 'b@example.com',
    operationId: 'switch-op',
    callerKey: 'caller',
    switchedAt: 7
  }
  const params = await test.prepare()
  expect(params.accountSwitch).toEqual({ accountId: 'account-b', account: 'b@example.com' })
  const request = reserveRequestFor({
    sessionId: 'child',
    params,
    models: undefined,
    callerKey: 'caller',
    fingerprint: 'fp',
    now: 9,
    authority: {
      spawnToken: () => 'unused',
      claimKeyId: 'claim',
      handoffOperationId: null,
      probe: { outcome: 'pid-absent' }
    }
  })
  expect(request.accountSwitch).toMatchObject({ accountId: 'account-b', switchedAt: 9 })
})

it('leaves the fork of an unpinned chat on the selected account', async () => {
  const test = forkTestSource(rig, 'claude')
  const params = await test.prepare()
  expect(params).not.toHaveProperty('accountSwitch')
})
