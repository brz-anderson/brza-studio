import { describe, expect, it } from 'vitest'
import { formatChatCursor, parseChatCursor } from './chat-cursor'

describe('chat cursor', () => {
  it('parses at the last colon and formats the cursor', () => {
    expect(parseChatCursor('a:b:7')).toEqual({ epoch: 'a:b', sequence: 7 })
    expect(formatChatCursor({ epoch: 'a:b', sequence: 7 })).toBe('a:b:7')
  })

  it.each(['abc', 'e:-1', ':3', 'e:1.5'])('rejects malformed cursors: %s', (value) => {
    expect(() => parseChatCursor(value)).toThrowError(
      expect.objectContaining({ code: 'invalid_argument' })
    )
  })
})
