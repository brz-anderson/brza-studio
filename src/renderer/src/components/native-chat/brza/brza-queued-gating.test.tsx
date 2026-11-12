// @vitest-environment happy-dom

// Gate delivery/card RPCs on queued-messages support; Stop/clear keep host-held drafts on the host and cards never also become transcript bubbles.

import { cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  AgentJournalRenderItem,
  AgentJournalSubmission
} from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import type { AgentSessionQueuedMessage } from '../../../../../shared/agent-session/requests/agent-session-queued-message-wire'
import type { StructuredAgentSessionPendingSend } from '../session/structured/delivery/structured-agent-session-pending-sends'
import type * as RewindModule from '../messages/actions/use-structured-agent-session-rewind'
import {
  structuredAgentSessionSendQueues,
  type StructuredAgentSessionQueueDelivery
} from '../queue/structured-agent-session-queue-request'

const mocks = vi.hoisted(() => ({
  call: vi.fn(),
  sendArgs: Array.of<{ queue?: StructuredAgentSessionQueueDelivery }>(),
  operations: 0,
  rewindPending: false
}))
let items: AgentJournalRenderItem[] = []
let queuedMessages: AgentSessionQueuedMessage[] | undefined
let submissions: AgentJournalSubmission[] = []
let nextQueuedMessageId: string | null = null
let pendingSends: StructuredAgentSessionPendingSend[] = []

vi.mock('@/runtime/native-chat/requests/structured-agent-session-call', () => ({
  subscribeStructuredAgentSessionStatus: vi.fn(async () => ({ unsubscribe: vi.fn() })),
  callStructuredAgentSession: mocks.call,
  supportsStructuredAgentSessionPromptCancel: vi.fn(async () => false)
}))

vi.mock('../session/structured/read/use-structured-agent-session-read', () => ({
  useStructuredAgentSessionRead: () => ({
    state: {
      fence: 3,
      items,
      submissions,
      status: 'ready',
      error: null,
      hasOlder: false,
      ...(queuedMessages !== undefined ? { queuedMessages, nextQueuedMessageId } : {})
    },
    loadingOlder: false,
    loadOlder: vi.fn()
  })
}))

// The real rewind hook, with only its in-flight latch forced when a test says so.
vi.mock('../messages/actions/use-structured-agent-session-rewind', async (importOriginal) => {
  const actual = await importOriginal<typeof RewindModule>()
  return {
    ...actual,
    useStructuredAgentSessionRewind: (
      ...args: Parameters<typeof actual.useStructuredAgentSessionRewind>
    ) => {
      const rewind = actual.useStructuredAgentSessionRewind(...args)
      return mocks.rewindPending ? { ...rewind, blockedRef: { current: true } } : rewind
    }
  }
})

vi.mock('../session/structured/delivery/use-structured-agent-session-sends', () => ({
  useStructuredAgentSessionSends: (args: { queue?: StructuredAgentSessionQueueDelivery }) => {
    mocks.sendArgs.push(args)
    return {
      pending: pendingSends,
      error: null,
      send: vi.fn(),
      stopSends: vi.fn()
    }
  }
}))

import { AGENT_SESSION_CONVERSATION_STOP_RUNTIME_CAPABILITY } from '../../../../../shared/agent-session/lifecycle/agent-session-stop-capabilities'
import { AGENT_SESSION_QUEUED_MESSAGES_RUNTIME_CAPABILITY } from '../../../../../shared/agent-session/agent-session-runtime-capabilities'
import { setLocalRuntimeCapabilitiesForTests } from '@/runtime/hosts/capabilities/local-runtime-capabilities'
import { clearNativeChatComposerDraftsForTests as clearNativeChatDraftCacheForTests } from '../drafts/native-chat-draft-reset'
import { useStructuredAgentSession } from '../session/structured/use-structured-agent-session'
import { legacySingleQuestionPromptItems } from '../prompts/native-chat-structured-question-test-fixtures'

const RUNNING_TURN: AgentJournalRenderItem = {
  itemId: 'turn-1',
  revision: 1,
  sequence: 1,
  observedAt: 1,
  body: { kind: 'turn', turnId: 'provider-turn', state: 'running' }
}

function draft(id: string): AgentSessionQueuedMessage {
  return {
    messageId: id,
    position: 1,
    body: { kind: 'message', role: 'user', blocks: [{ type: 'text', text: `queued ${id}` }] },
    state: 'waiting'
  }
}

// Omit the preference to exercise the production default; explicit OFF stays separate.
function render(queueFollowUps?: boolean) {
  return renderHook(() =>
    useStructuredAgentSession({
      sessionId: 'session-1',
      agent: 'claude',
      target: { kind: 'local' },
      isVisible: true,
      composerScopeKey: 'scope-1',
      queueFollowUps
    })
  )
}

/** The last render's sends: the host's answer, and whether a send queues (or its alternate). */
function lastQueue(alternate?: boolean): { capability: string; enabled: boolean } {
  const queue = mocks.sendArgs.at(-1)!.queue!
  return {
    capability: queue.capability,
    enabled: structuredAgentSessionSendQueues(queue, alternate)
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.sendArgs.length = 0
  mocks.rewindPending = false
  mocks.call.mockImplementation(async (_target, method) =>
    method === 'agentSession.cancel'
      ? {
          ok: true,
          replayed: false,
          fence: 3,
          cursor: { epoch: 'e', sequence: 1 },
          value: { cancelled: true }
        }
      : null
  )
  items = [RUNNING_TURN]
  queuedMessages = undefined
  submissions = []
  nextQueuedMessageId = null
  pendingSends = []
  localStorage.clear()
  clearNativeChatDraftCacheForTests()
})

afterEach(() => {
  cleanup()
  setLocalRuntimeCapabilitiesForTests(null)
})

describe('against a capable host', () => {
  beforeEach(() => {
    setLocalRuntimeCapabilitiesForTests([
      AGENT_SESSION_CONVERSATION_STOP_RUNTIME_CAPABILITY,
      AGENT_SESSION_QUEUED_MESSAGES_RUNTIME_CAPABILITY
    ])
  })

  it('behind a pending question, queues the send and holds the newest card from steering', () => {
    items = [RUNNING_TURN, ...legacySingleQuestionPromptItems]
    queuedMessages = [draft('draft-1')]
    const { result } = render()
    expect(lastQueue()).toEqual({ capability: 'supported', enabled: true })
    expect(result.current.queuedMessages.steerHeld).toBe(true)
    expect(result.current.queuedMessages.steerHead?.()).toBe(false)
    expect(
      mocks.call.mock.calls.filter(([, method]) => method === 'agentSession.queuedMessageSend')
    ).toHaveLength(0)
  })
})
