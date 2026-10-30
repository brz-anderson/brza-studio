// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { brzaClaudePeerSource } from '../../../../../shared/native-chat/brza/brza-claude-peer-sender'
import { NativeChatAgentMessageSenders } from '../NativeChatAgentMessageSenders'

afterEach(cleanup)

describe('a Claude Code peer as the sender row', () => {
  it('reads "Message from" another session and "Hand-back from" a subagent, as plain names', () => {
    render(
      <>
        <NativeChatAgentMessageSenders
          from={brzaClaudePeerSource('message', 'uds:/tmp/cc-socks/1.sock', 'revisor')}
          chatWorktreeId="wt"
        />
        <NativeChatAgentMessageSenders
          from={brzaClaudePeerSource('hand-back', 'a71c894b1e32def66', 'general-purpose')}
          chatWorktreeId="wt"
        />
      </>
    )

    expect(screen.getByText('Message from')).toBeInTheDocument()
    expect(screen.getByText('Hand-back from')).toBeInTheDocument()
    expect(screen.getByText('revisor').closest('button')).toBeNull()
    expect(screen.getByText('general-purpose').closest('button')).toBeNull()
  })
})
