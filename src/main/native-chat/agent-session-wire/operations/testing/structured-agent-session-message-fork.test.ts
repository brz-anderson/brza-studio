import { describe, expect, it, vi } from 'vitest'
import { agentSessionRecordFixture } from '../../../../../shared/agent-session/lifecycle/agent-session-record.test-fixture'
import type { AgentSessionRecord } from '../../../../../shared/agent-session/lifecycle/agent-session-record'
import { forkStructuredAgentSessionThroughMessage } from '../structured-agent-session-message-fork'

const ITEM_ID = 'claude:source-session:message-uuid'

function forkHost(record: AgentSessionRecord) {
  const forkThroughMessage = vi.fn(async () => ({
    ok: true as const,
    providerSessionId: 'forked-session'
  }))
  return {
    deps: { store: { getRecord: () => record }, adapter: { forkThroughMessage } },
    journalSnapshot: async () => ({
      items: [
        {
          itemId: ITEM_ID,
          body: { kind: 'message' as const, role: 'assistant' as const, blocks: [] }
        }
      ]
    })
  }
}

describe('forking a chat through one of its messages', () => {
  it.each([{ accountId: 'account-b' }, { accountId: null }])(
    'names the account a switched chat is pinned to, so the fork opens there (%o)',
    async ({ accountId }) => {
      const record: AgentSessionRecord = {
        ...agentSessionRecordFixture(),
        accountSwitch: {
          accountId,
          account: 'b@example.com',
          operationId: 'op-1',
          callerKey: 'client-1',
          switchedAt: 1
        }
      }
      await expect(
        forkStructuredAgentSessionThroughMessage(forkHost(record), {
          sessionId: record.sessionId,
          itemId: ITEM_ID
        })
      ).resolves.toEqual({
        ok: true,
        providerSessionId: 'forked-session',
        accountSwitch: { accountId }
      })
    }
  )

  it('names no account for a chat that follows the selection', async () => {
    const record = agentSessionRecordFixture()
    await expect(
      forkStructuredAgentSessionThroughMessage(forkHost(record), {
        sessionId: record.sessionId,
        itemId: ITEM_ID
      })
    ).resolves.toEqual({ ok: true, providerSessionId: 'forked-session' })
  })
})
