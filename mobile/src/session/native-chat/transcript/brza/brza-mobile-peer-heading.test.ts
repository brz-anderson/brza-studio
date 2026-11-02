import { describe, expect, it } from 'vitest'
import {
  brzaClaudeHandBack,
  brzaClaudePeerSource
} from '../../../../../../src/shared/native-chat/brza/brza-claude-peer-sender'

describe('a Claude Code peer on mobile', () => {
  it('reads as a hand-back only for a subagent report', () => {
    const handBack = brzaClaudePeerSource('hand-back', 'a71c', 'general-purpose')
    const message = brzaClaudePeerSource('message', 'uds:/tmp/cc-socks/1.sock', 'revisor')

    expect(brzaClaudeHandBack(handBack)).toBe(true)
    expect(brzaClaudeHandBack(message)).toBe(false)
  })
})
