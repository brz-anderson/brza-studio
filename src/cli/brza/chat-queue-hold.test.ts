import { describe, expect, it } from 'vitest'
import type { AgentSessionHistoryPage } from '../../shared/agent-session/agent-session-wire'
import { chatQueueHold } from './chat-queue-hold'

function page(overrides: Partial<AgentSessionHistoryPage>): AgentSessionHistoryPage {
  return {
    sessionId: 'session',
    epoch: 'e',
    direction: 'tail',
    items: [],
    removedItemIds: [],
    submissions: [],
    window: { oldest: null, newest: null, nextCursor: { epoch: 'e', sequence: 0 } },
    hasOlder: false,
    hasNewer: false,
    ...overrides
  }
}

describe('chatQueueHold', () => {
  it('prioritizes an actionable question over working', () => {
    expect(chatQueueHold(page({ actionablePromptIds: ['p1'], working: true }))).toBe('question')
  })
  it('reports working when there is no prompt and null when drained or paused', () => {
    expect(chatQueueHold(page({ working: true }))).toBe('working')
    expect(chatQueueHold(page({}))).toBeNull()
    expect(chatQueueHold(page({ queuePause: { reason: 'stopped' } }))).toBeNull()
  })
})
