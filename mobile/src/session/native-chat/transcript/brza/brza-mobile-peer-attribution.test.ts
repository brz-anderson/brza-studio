import { describe, expect, it } from 'vitest'
import { agentMessageAttribution } from '../../../mobile-agent-message-attribution'
import {
  brzaClaudeHandBack,
  brzaClaudePeerSource
} from '../../../../../../src/shared/native-chat/brza/brza-claude-peer-sender'

describe('a Claude Code peer on mobile', () => {
  it('reads "Hand-back from" only for a subagent report', () => {
    const handBack = brzaClaudePeerSource('hand-back', 'a71c', 'general-purpose')
    const message = brzaClaudePeerSource('message', 'uds:/tmp/cc-socks/1.sock', 'revisor')

    expect(brzaClaudeHandBack(handBack)).toBe(true)
    expect(brzaClaudeHandBack(message)).toBe(false)
    expect(agentMessageAttribution('Hand-back from', handBack)).toBe(
      'Hand-back from general-purpose'
    )
  })
})
