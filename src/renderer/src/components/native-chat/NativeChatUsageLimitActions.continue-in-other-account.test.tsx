// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { NativeChatUsageLimitActionsProvider } from './usage/NativeChatUsageLimitActions'
import { NativeChatNoticeRow } from './messages/notices/NativeChatNoticeRow'
import type { NativeChatOrcaStopView } from './messages/notices/native-chat-orca-stop-context'
import type { NativeChatAccountSwitchView } from './use-native-chat-account-switch'
import type { RuntimeClientTarget } from '../../../../shared/runtime-client-target'

type Pinned = { accountId: string; account: string } | null
const mocks = vi.hoisted(() => {
  const state: { pinned: Pinned } = { pinned: null }
  return Object.assign(state, { call: vi.fn(), select: vi.fn() })
})
vi.mock('./session/status/structured-agent-session-status-hooks', () => ({
  useStructuredAgentSessionAccountSwitch: () => mocks.pinned
}))
vi.mock('@/runtime/native-chat/requests/structured-agent-session-call', () => ({
  callStructuredAgentSession: mocks.call
}))
vi.mock('@/runtime/provider-accounts/observations/runtime-provider-accounts-client', () => ({
  selectClaudeProviderAccount: mocks.select
}))
vi.mock('@/runtime/native-chat/naming/structured-conversation-name', () => ({
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
  mocks.call.mockReset()
  mocks.select.mockReset()
})

// BrzA P40/P79 (pedido 41): on a usage-limit row, Continue in another account takes the place of
// the account switch beside Hand Off. A pinned chat moves with its own switch (P36); a chat that
// follows the selection moves with the global one, which a pinned chat would ignore.
function renderLimitRow(
  chatAccountSwitch: NativeChatAccountSwitchView | null,
  target: RuntimeClientTarget = { kind: 'local' }
) {
  const continueUsageLimit = vi.fn()
  const cancel = vi.fn()
  const view: NativeChatOrcaStopView = {
    hostLabel: null,
    remoteHost: false,
    continueAvailable: false,
    offeredTurnItemId: null,
    continueNow: vi.fn(),
    usageLimitTurnItemId: 'cut',
    continueUsageLimit,
    usageLimitAutoContinue: { kind: 'scheduled', resetsAt: Date.UTC(2026, 10, 2, 15, 1), cancel }
  }
  render(
    <TooltipProvider>
      <NativeChatUsageLimitActionsProvider
        recovery={{ readCurrent: true, canSwitchAccount: true }}
        chatAccountSwitch={chatAccountSwitch}
        view={view}
        pane={{
          tabId: 'tab',
          sessionId: 'chat',
          agent: 'claude',
          target,
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
  return { continueUsageLimit, cancel }
}

function accountSwitch(switchTo = vi.fn(async () => true)): NativeChatAccountSwitchView {
  return {
    current: { id: 'b', label: 'b@example.com' },
    choices: [
      { id: 'b', label: 'b@example.com', disabled: false },
      { id: 'c', label: 'c@example.com', disabled: false }
    ],
    refresh: vi.fn(),
    switching: false,
    switchTo
  }
}

async function chooseAccount(label: string): Promise<void> {
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Continue in another account' }), {
    button: 0,
    ctrlKey: false,
    pointerType: 'mouse'
  })
  await act(async () => {
    fireEvent.click(await screen.findByText(label))
  })
}

it('moves a pinned chat with its own switch, then cancels the schedule and continues', async () => {
  mocks.pinned = { accountId: 'b', account: 'b@example.com' }
  const switchTo = vi.fn(async () => true)
  const { continueUsageLimit, cancel } = renderLimitRow(accountSwitch(switchTo))
  expect(screen.queryByRole('button', { name: 'Global switcher' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Account b@example.com' })).toBeNull()
  expect(screen.getByRole('button', { name: "Don't continue" })).toBeInTheDocument()
  await chooseAccount('c@example.com')
  expect(switchTo).toHaveBeenCalledWith('c')
  expect(cancel).toHaveBeenCalledOnce()
  expect(continueUsageLimit).toHaveBeenCalledOnce()
})

it('moves a chat that follows the selection with the global switch, then continues', async () => {
  const switchTo = vi.fn(async () => true)
  const target = { kind: 'environment', environmentId: 'env' } as const
  mocks.call.mockResolvedValue({ canSwitchAccount: true })
  mocks.select.mockResolvedValue({ accounts: [], activeAccountId: 'c' })
  const { continueUsageLimit } = renderLimitRow(accountSwitch(switchTo), target)
  expect(screen.queryByRole('button', { name: 'Global switcher' })).toBeNull()
  await chooseAccount('c@example.com')
  expect(switchTo).not.toHaveBeenCalled()
  expect(mocks.select).toHaveBeenCalledWith(target, {
    accountId: 'c',
    runtime: 'host',
    wslDistro: null
  })
  expect(continueUsageLimit).toHaveBeenCalledOnce()
})

it('sends nothing when the host refuses to move a chat that follows the selection', async () => {
  mocks.call.mockResolvedValue({ canSwitchAccount: false })
  const { continueUsageLimit } = renderLimitRow(accountSwitch(), {
    kind: 'environment',
    environmentId: 'env'
  })
  await chooseAccount('c@example.com')
  expect(mocks.select).not.toHaveBeenCalled()
  expect(continueUsageLimit).not.toHaveBeenCalled()
})

it('keeps the global switcher where the chat has no account switch', () => {
  renderLimitRow(null)
  expect(screen.getByRole('button', { name: 'Global switcher' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Continue in another account' })).toBeNull()
})
