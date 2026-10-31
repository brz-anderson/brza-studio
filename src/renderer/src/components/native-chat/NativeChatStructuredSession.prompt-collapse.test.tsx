// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AgentJournalRenderItem } from '../../../../shared/agent-session-journal-types'
import { TooltipProvider } from '@/components/ui/tooltip'
import { claudeGroupedQuestionPromptItems } from './native-chat-structured-question-test-fixtures'

const { mocks, moduleFactories, resetStructuredSessionMocks } = await vi.hoisted(async () =>
  (await import('./NativeChatStructuredSession.test-harness')).createStructuredSessionMocks()
)

// The cards stay real: a collapse must keep their half-given answer.
vi.mock('@/runtime/structured-agent-session-client', () =>
  moduleFactories.structuredAgentSessionClient()
)
vi.mock('./use-structured-agent-session', () => moduleFactories.useStructuredAgentSession())
vi.mock('./use-native-chat-font-size', () => moduleFactories.useNativeChatFontSize())
vi.mock('./use-native-chat-file-link-context', () => moduleFactories.useNativeChatFileLinkContext())
vi.mock('./use-native-chat-tab-owner', () => moduleFactories.useNativeChatTabOwner())
vi.mock('./NativeChatMessageList', () => moduleFactories.nativeChatMessageList())
vi.mock('./NativeChatComposer', () => moduleFactories.nativeChatComposer())
vi.mock('./NativeChatEmptyState', () => moduleFactories.nativeChatEmptyState())

import { NativeChatStructuredSession } from './NativeChatStructuredSession'

afterEach(() => {
  cleanup()
  resetStructuredSessionMocks()
})

function approvalItem(itemId: string, title: string): AgentJournalRenderItem {
  return {
    itemId,
    revision: 1,
    sequence: 1,
    observedAt: 1,
    body: {
      kind: 'approval',
      title,
      detail: 'pnpm test',
      options: [{ id: 'allow', label: 'Allow' }],
      resolution: { state: 'pending', selectedOptionId: null, resolvedBy: null, resolvedAt: null }
    }
  }
}

const view = () => (
  <TooltipProvider>
    <NativeChatStructuredSession
      isVisible
      isFocusedGroup
      tabId="structured-collapse"
      sessionId="session-collapse"
      target={{ kind: 'local' }}
      agent="claude"
    />
  </TooltipProvider>
)

function strip(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-native-chat-prompt-strip="true"]')
}

async function settleFocus(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100))
  })
}

describe('a structured prompt card collapses to a strip above the usable composer', () => {
  it('a question folds with its pick kept, gives the composer back, and unfolds where it was', async () => {
    mocks.isWorking = true
    mocks.turnId = 'turn-question'
    mocks.promptItems = claudeGroupedQuestionPromptItems
    render(view())
    const card = screen.getByRole('group', { name: 'Which targets?' })
    expect(screen.queryByTestId('structured-composer')).toBeNull()
    fireEvent.click(within(card).getByRole('button', { name: /Web/ }))

    act(() => fireEvent.click(within(card).getByRole('button', { name: 'Collapse' })))
    await settleFocus()
    expect(card.isConnected).toBe(true)
    expect(card.closest('[hidden]')).not.toBeNull()
    expect(strip()?.textContent).toContain('Which targets?')
    expect(screen.getByTestId('structured-composer')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByTestId('structured-composer'))
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(mocks.respond).not.toHaveBeenCalled()

    act(() => fireEvent.click(within(strip()!).getByRole('button', { name: 'Expand' })))
    const reopened = screen.getByRole('group', { name: 'Which targets?' })
    expect(reopened).toBe(card)
    expect(reopened.closest('[hidden]')).toBeNull()
    expect(within(reopened).getByRole('button', { name: /Web/ }).getAttribute('aria-pressed')).toBe(
      'true'
    )
    expect(strip()).toBeNull()
    expect(screen.queryByTestId('structured-composer')).toBeNull()
    expect(reopened.contains(document.activeElement)).toBe(true)
  })

  it('an approval folds by its chevron beside the X, and a new prompt opens unfolded', async () => {
    mocks.isWorking = true
    mocks.turnId = 'turn-approval'
    mocks.promptItems = [approvalItem('approval-1', 'Allow command?')]
    const { rerender } = render(view())
    const card = document.querySelector<HTMLElement>('[data-native-chat-approval-card="true"]')!
    expect(within(card).getByRole('button', { name: 'Cancel' })).toBeTruthy()

    act(() => fireEvent.keyDown(card, { key: 'Escape' }))
    await settleFocus()
    expect(mocks.cancel).not.toHaveBeenCalled()
    expect(card.closest('[hidden]')).not.toBeNull()
    expect(strip()?.textContent).toContain('Allow command?')
    expect(screen.getByTestId('structured-composer')).toBeTruthy()

    act(() => fireEvent.click(within(strip()!).getByRole('button', { name: 'Expand' })))
    expect(card.closest('[hidden]')).toBeNull()
    expect(screen.queryByTestId('structured-composer')).toBeNull()

    act(() => fireEvent.click(within(card).getByRole('button', { name: 'Collapse' })))
    expect(strip()).not.toBeNull()
    mocks.promptItems = [approvalItem('approval-2', 'Allow another command?')]
    rerender(view())
    expect(strip()).toBeNull()
    const next = screen.getByRole('group', { name: 'Allow another command?' })
    expect(next.closest('[hidden]')).toBeNull()
    expect(screen.queryByTestId('structured-composer')).toBeNull()
  })
})
