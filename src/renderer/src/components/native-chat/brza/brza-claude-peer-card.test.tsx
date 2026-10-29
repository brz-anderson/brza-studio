// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { render } from '../native-chat-tooltip-test-harness'
import { NativeChatAgentMessageCard } from '../NativeChatAgentMessageCard'
import {
  brzaClaudePeerSource,
  type BrzaClaudePeerKind
} from '../../../../../shared/native-chat/brza/brza-claude-peer-sender'
import type { NativeChatMessage } from '../../../../../shared/native-chat-types'

afterEach(cleanup)

function peerCard(kind: BrzaClaudePeerKind, id: string, name: string, text: string) {
  const message: NativeChatMessage = {
    id: `${kind}-row`,
    role: 'user',
    blocks: [{ type: 'text', text }],
    timestamp: Date.parse('2026-10-29T10:00:00.000Z'),
    source: 'transcript',
    from: brzaClaudePeerSource(kind, id, name)
  }
  return (
    <NativeChatAgentMessageCard
      message={message}
      from={message.from!}
      runtimeContext={{ worktreeId: 'wt', worktreePath: null, target: { kind: 'local' } }}
      allowFileUriLinks={false}
      onRefolded={() => {}}
    />
  )
}

describe('a Claude Code peer in the agent message card', () => {
  it('heads another session\'s message "Message from" and a subagent\'s report "Hand-back from", with plain names', () => {
    render(
      <>
        {peerCard('message', 'uds:/tmp/cc-socks/1.sock', 'revisor', 'oi')}
        {peerCard('hand-back', 'a71c894b1e32def66', 'general-purpose', 'o relatório')}
      </>
    )

    expect(screen.getByText('Message from')).toBeInTheDocument()
    expect(screen.getByText('Hand-back from')).toBeInTheDocument()
    expect(screen.getByText('oi')).toBeInTheDocument()
    expect(screen.getByText('o relatório')).toBeInTheDocument()
    expect(screen.getByText('revisor').closest('button')).toBeNull()
    expect(screen.getByText('general-purpose').closest('button')).toBeNull()
  })
})
