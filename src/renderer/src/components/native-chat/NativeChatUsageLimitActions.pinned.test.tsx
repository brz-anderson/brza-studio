// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NativeChatUsageLimitActionsProvider } from './NativeChatUsageLimitActions'
import { NativeChatNoticeRow } from './NativeChatNoticeRow'
import type { NativeChatOrcaStopView } from './native-chat-orca-stop-context'
import type { NativeChatAccountSwitchView } from './use-native-chat-account-switch'

const mocks = vi.hoisted(() => ({ pinned: null as null | { accountId: string; account: string } }))
vi.mock('./structured-agent-session-status-hooks', () => ({
  useStructuredAgentSessionAccountSwitch: () => mocks.pinned
}))
vi.mock('@/runtime/structured-agent-session-client', () => ({
  callStructuredAgentSession: vi.fn()
}))
vi.mock('@/runtime/structured-conversation-name', () => ({
  useStructuredChatTabConversationName: () => 'My chat'
}))
vi.mock('@/components/status-bar/ClaudeSwitcherMenu', () => ({
  ClaudeSwitcherMenu: () => <button type="button">Global switcher</button>
}))
vi.mock('@/components/agent-session-continuation/AgentSessionContinuationDialog', () => ({
  AgentSessionContinuationDialog: () => null
}))
afterEach(() => {
  cleanup()
  mocks.pinned = null
})

// BrzA P36: a chat pinned to an account moves with the chat's own switch on a usage-limit row; the
// global switcher only writes the selection, which a pinned chat ignores.
function renderLimitRow(chatAccountSwitch: NativeChatAccountSwitchView | null) {
  const view: NativeChatOrcaStopView = {
    hostLabel: null,
    remoteHost: false,
    continueAvailable: false,
    offeredTurnItemId: null,
    continueNow: vi.fn(),
    usageLimitTurnItemId: 'cut',
    continueUsageLimit: vi.fn()
  }
  return render(
    <TooltipProvider>
      <NativeChatUsageLimitActionsProvider
        recovery={{ readCurrent: true, canSwitchAccount: true }}
        chatAccountSwitch={chatAccountSwitch}
        view={view}
        pane={{
          tabId: 'tab',
          sessionId: 'chat',
          agent: 'claude',
          target: { kind: 'local' },
          isVisible: true,
          isFocusedGroup: true
        }}
        directory={null}
        messages={[]}
      >
        <NativeChatNoticeRow
          agentName="Claude"
          block={{
            type: 'text',
            text: 'Limited',
            tone: 'warning',
            failure: { kind: 'usageLimitReached' },
            usageLimitTurnItemId: 'cut'
          }}
        />
      </NativeChatUsageLimitActionsProvider>
    </TooltipProvider>
  )
}

const switchTo = vi.fn(async () => true)
const accountSwitch: NativeChatAccountSwitchView = {
  current: { id: 'b', label: 'b@example.com' },
  choices: [
    { id: 'b', label: 'b@example.com', disabled: false },
    { id: 'c', label: 'c@example.com', disabled: false }
  ],
  refresh: vi.fn(),
  switching: false,
  switchTo
}

it('offers the chat’s own account switch on the limit row of a pinned chat', async () => {
  mocks.pinned = { accountId: 'b', account: 'b@example.com' }
  renderLimitRow(accountSwitch)
  expect(screen.queryByRole('button', { name: 'Global switcher' })).toBeNull()
  const picker = screen.getByRole('button', { name: 'Account b@example.com' })
  fireEvent.pointerDown(picker, { button: 0, ctrlKey: false, pointerType: 'mouse' })
  fireEvent.click(await screen.findByRole('menuitemradio', { name: 'c@example.com' }))
  expect(switchTo).toHaveBeenCalledWith('c')
})

it('keeps the global switcher on the limit row of a chat that follows the selection', () => {
  mocks.pinned = null
  renderLimitRow(accountSwitch)
  expect(screen.getByRole('button', { name: 'Global switcher' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Account b@example.com' })).toBeNull()
})
