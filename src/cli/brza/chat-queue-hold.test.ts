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
  it.each(['approval', 'question'] as const)('fallback %s pending vence working', (kind) => {
    const resolution = {
      state: 'pending' as const,
      selectedOptionId: null,
      resolvedBy: null,
      resolvedAt: null
    }
    const body =
      kind === 'approval'
        ? { kind, title: 'Allow?', detail: null, options: [], resolution }
        : { kind, question: 'Answer?', options: [], resolution }
    const items = [{ itemId: 'p1', revision: 1, sequence: 1, observedAt: 1, body }]
    expect(chatQueueHold(page({ items }))).toBe('question')
    expect(chatQueueHold(page({ items, working: true }))).toBe('question')
    expect(chatQueueHold(page({ items, actionablePromptIds: [], working: true }))).toBe('working')
  })

  it.each(['approval', 'question'] as const)('fallback %s resolvido não segura a fila', (kind) => {
    const resolution = {
      state: 'resolved' as const,
      selectedOptionId: 'yes',
      resolvedBy: 'user',
      resolvedAt: 2
    }
    const body =
      kind === 'approval'
        ? { kind, title: 'Allow?', detail: null, options: [], resolution }
        : { kind, question: 'Answer?', options: [], resolution }
    const items = [{ itemId: 'p1', revision: 1, sequence: 1, observedAt: 1, body }]
    expect(chatQueueHold(page({ items }))).toBeNull()
    expect(chatQueueHold(page({ items, working: true }))).toBe('working')
  })

  it('fallback sem prompt ignora mensagens e retorna working ou null', () => {
    const items: AgentSessionHistoryPage['items'] = [
      {
        itemId: 'm1',
        revision: 1,
        sequence: 1,
        observedAt: 1,
        body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: 'hi' }] }
      }
    ]
    expect(chatQueueHold(page({ items }))).toBeNull()
    expect(chatQueueHold(page({ items, working: true }))).toBe('working')
  })
})
