import { describe, expect, it } from 'vitest'
import { chatSendOutcome } from './chat-send-outcome'

describe('chatSendOutcome', () => {
  it.each([
    [
      { ok: true, value: { clientMessageId: 'm', submission: { dispatchState: 'accepted' } } },
      'submitted',
      'accepted',
      0
    ],
    [
      {
        ok: true,
        value: { clientMessageId: 'm', submission: { dispatchState: 'rejected', reason: 'no' } }
      },
      'submitted',
      'rejected',
      1
    ],
    [
      { ok: true, value: { clientMessageId: 'm', submission: { dispatchState: 'pending' } } },
      'submitted',
      'pending',
      3
    ],
    [
      { ok: true, value: { clientMessageId: 'm', submission: { dispatchState: 'unknown' } } },
      'submitted',
      'unknown',
      3
    ],
    [{ ok: false, refusal: { code: 'conflict', message: 'no' } }, 'refused', 'refused', 1],
    [
      { ok: false, refusal: { code: 'agent_session_operation_unknown', message: 'unknown' } },
      'unknown',
      'unknown',
      3
    ],
    [
      {
        ok: true,
        value: { clientMessageId: 'm', queued: { messageId: 'q', position: 2, state: 'waiting' } }
      },
      'queued',
      'queued',
      0
    ],
    [
      {
        ok: true,
        replayed: true,
        value: { clientMessageId: 'm', queued: { messageId: 'q', position: 2, state: 'returned' } }
      },
      'queued',
      'rejected',
      1
    ],
    [
      {
        ok: true,
        replayed: true,
        value: { clientMessageId: 'm', queued: { messageId: 'q', position: 2, state: 'withdrawn' } }
      },
      'queued',
      'rejected',
      1
    ]
  ] as const)('maps %j to the D4 contract', (response, delivery, state, exitCode) => {
    expect(chatSendOutcome(response)).toMatchObject({ delivery, submission: { state }, exitCode })
  })
})
