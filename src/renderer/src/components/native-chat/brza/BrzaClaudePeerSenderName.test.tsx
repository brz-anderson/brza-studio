// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { makeUnifiedTab } from '@/store/slices/store-test-helpers'
import { render } from '../native-chat-tooltip-test-harness'
import { NativeChatAgentMessageSenders } from '../NativeChatAgentMessageSenders'
import { brzaClaudePeerSource } from '../../../../../shared/native-chat/brza/brza-claude-peer-sender'

const activate = vi.hoisted(() => vi.fn(async () => true))
vi.mock('@/lib/activate-ai-vault-structured-session', () => ({
  activateAiVaultStructuredSession: activate
}))

const initialState = useAppStore.getInitialState()

beforeEach(() => {
  useAppStore.setState({
    unifiedTabsByWorktree: {
      'wt-revisor': [
        makeUnifiedTab({
          id: 'agent-session:session-revisor',
          entityId: 'session-revisor',
          worktreeId: 'wt-revisor',
          groupId: 'g',
          contentType: 'agent-session',
          label: 'revisor'
        })
      ]
    }
  })
})

afterEach(() => {
  cleanup()
  activate.mockClear()
  useAppStore.setState(initialState, true)
})

function senders(name: string) {
  return (
    <NativeChatAgentMessageSenders
      from={brzaClaudePeerSource('message', `uds:/tmp/cc-socks/${name}.sock`, name)}
      chatWorktreeId="wt-chat"
    />
  )
}

describe('the name of a Claude Code peer', () => {
  it('focuses the open chat tab that carries the session name', () => {
    render(senders('revisor'))

    fireEvent.click(screen.getByRole('button', { name: /revisor/ }))

    expect(activate).toHaveBeenCalledWith({
      structuredSession: { workspaceId: 'wt-revisor', sessionId: 'session-revisor' }
    })
  })

  it('stays plain text when no open chat tab carries the name', () => {
    render(senders('brza-workspace-5b'))

    expect(screen.getByText('brza-workspace-5b').closest('button')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })
})
