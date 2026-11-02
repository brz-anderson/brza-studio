import { expect, it } from 'vitest'
import {
  agentSessionLeaseFixture,
  agentSessionRecordFixture
} from '../../shared/agent-session/lifecycle/agent-session-record.test-fixture'
import { commitAccountSwitchRecord } from './agent-session-account-switch-record'
import type { AgentSessionStoreState } from './agent-session/records/agent-session-store-state'

it('drops the last launch account receipt when a switch moves the chat', () => {
  const lease = agentSessionLeaseFixture({
    ownerProcess: null,
    claimStatus: 'released',
    reservedSpawnToken: null
  })
  const record = { ...agentSessionRecordFixture(lease), acquiredAccount: { recipe: 'left' } }
  const state = {
    records: new Map([[record.sessionId, record]])
  } as unknown as AgentSessionStoreState
  const accountHome = { variable: 'CLAUDE_CONFIG_DIR', path: '/accounts/b' }
  const accountSwitch = {
    accountId: 'b',
    account: 'b@example.com',
    operationId: 'op-1',
    callerKey: 'caller',
    switchedAt: 5
  }
  commitAccountSwitchRecord(state, {
    sessionId: record.sessionId,
    fence: lease.runtimeFence,
    accountHome,
    accountSwitch
  })
  const written = state.records.get(record.sessionId)
  expect(written).toMatchObject({ accountHome, accountSwitch })
  expect(written).not.toHaveProperty('acquiredAccount')
})
