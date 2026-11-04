import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { createStructuredAgentSessionOperationId } from '../../shared/agent-session/lifecycle/structured-agent-session-mutation'
import { CHAT_OPERATION_ID_PATTERN, parseChatOperationId } from './chat-operation-id'

const OPERATION = '1793750400000-3f2a9c0e8b7d4a1f9e6c5b4a3d2e1f00'

describe('chat operation id', () => {
  it('aceita o id sem transformá-lo e corresponde ao gerador', () => {
    const generated = createStructuredAgentSessionOperationId(randomUUID)
    expect(CHAT_OPERATION_ID_PATTERN.source).toBe('^\\d{13}-[0-9a-f]{32}$')
    expect(parseChatOperationId(OPERATION)).toBe(OPERATION)
    expect(parseChatOperationId(generated)).toBe(generated)
  })

  it.each([
    '',
    'abc',
    OPERATION.toUpperCase(),
    OPERATION.slice(1),
    `${OPERATION}0`,
    OPERATION.replace('-', ''),
    OPERATION.replace('3f2a', '3g2a'),
    ` ${OPERATION}`,
    `${OPERATION} `,
    `${OPERATION}\n`,
    `${OPERATION}\r\n`
  ])('recusa id malformado %j', (value) => {
    expect(() => parseChatOperationId(value)).toThrowError(
      expect.objectContaining({ code: 'invalid_argument' })
    )
  })
})
