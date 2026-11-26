// @vitest-environment happy-dom
import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useStructuredAgentSessionSends } from '@/components/native-chat/session/structured/delivery/use-structured-agent-session-sends'
import { resetStructuredAgentSessionSendsForTests } from '@/components/native-chat/session/structured/delivery/structured-agent-session-message-sender'
import type { NativeChatStructuredComposerTransport } from '@/components/native-chat/composer/submit/native-chat-structured-composer-transport'
import { agentSessionFailureWords } from '../../../../../shared/agent-session/failures/agent-session-failure-words'
import { agentJournalItemKey } from '../../../../../shared/agent-session/journal/agent-session-journal-item-key'
import type { AgentJournalRenderItem } from '../../../../../shared/agent-session/journal/agent-session-journal-types'
import type { RuntimeClientTarget } from '../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import { NativeChatNoticeRow } from '../messages/notices/NativeChatNoticeRow'
import type { NativeChatAccountSwitchView } from '../use-native-chat-account-switch'
import { useNativeChatInterruptedContinuation } from './NativeChatInterruptedContinue'
import { NativeChatUsageLimitActionsProvider } from './NativeChatUsageLimitActions'

const mocks = vi.hoisted(() => ({ call: vi.fn(), pinned: true as boolean }))
vi.mock('@/components/native-chat/telemetry/native-chat-telemetry', () => ({
  emitNativeChatMessageSent: vi.fn()
}))
vi.mock('@/runtime/rpc/compatibility/runtime-compatibility-probe', () => ({
  ensureRuntimeEnvironmentCompatible: async () => {}
}))
vi.mock('@/runtime/native-chat/requests/structured-agent-session-call', () => ({
  callStructuredAgentSession: mocks.call
}))
vi.mock('@/runtime/native-chat/host-capabilities/structured-agent-session-host-capability', () => ({
  useStructuredAgentSessionHostCapabilityState: () => 'supported'
}))
vi.mock('@/components/native-chat-recovery/offers/native-chat-restart-runtimes', () => ({
  useNativeChatTargetRestartResuming: () => []
}))
vi.mock('@/components/native-chat-recovery/offers/native-chat-launch-resume-decision', () => ({
  useNativeChatLaunchResumePending: () => false
}))
vi.mock('@/components/native-chat/pane/ownership/use-structured-agent-session-host-label', () => ({
  useStructuredAgentSessionHostLabel: () => null
}))
vi.mock('../session/status/structured-agent-session-status-hooks', () => ({
  useStructuredAgentSessionAccountSwitch: () =>
    mocks.pinned ? { accountId: 'b', account: 'b@example.com' } : null
}))
vi.mock('@/runtime/provider-accounts/observations/runtime-provider-account-selection', () => ({
  selectClaudeProviderAccount: async () => ({ accounts: [], activeAccountId: 'c' })
}))
vi.mock('@/runtime/native-chat/naming/structured-conversation-name', () => ({
  useStructuredChatTabConversationName: () => 'My chat'
}))
vi.mock('@/components/status-bar/accounts/ClaudeSwitcherMenu', () => ({
  ClaudeSwitcherMenu: () => null
}))
vi.mock('@/components/agent-session-continuation/AgentSessionContinuationDialog', () => ({
  AgentSessionContinuationDialog: () => null
}))

afterEach(() => {
  cleanup()
  resetStructuredAgentSessionSendsForTests()
  mocks.call.mockReset()
})
beforeEach(() => {
  mocks.pinned = true
  mocks.call.mockImplementation(async (_target: unknown, method: string) =>
    method === 'agentSession.options' ? { canSwitchAccount: true } : new Promise(() => {})
  )
})

const TARGET: RuntimeClientTarget = { kind: 'local' }
const TURN = agentJournalItemKey({ provider: 'orca', clientMessageId: 'limited' })
const RESETS_AT = Date.parse('2999-01-01T00:00:00Z')
const limitedChat: AgentJournalRenderItem[] = [
  {
    itemId: TURN,
    revision: 2,
    sequence: 1,
    observedAt: 1,
    body: {
      kind: 'turn',
      turnId: 'limited',
      state: 'completed',
      outcome: 'failure',
      startedAt: 1,
      completedAt: 5
    }
  },
  {
    itemId: agentJournalItemKey({ provider: 'orca', clientMessageId: 'limit' }),
    revision: 1,
    sequence: 2,
    observedAt: 6,
    turnScope: { kind: 'turn', turnItemId: TURN },
    body: {
      kind: 'status',
      ...agentSessionFailureWords(
        { kind: 'usageLimitReached', usageLimit: { resetsAt: RESETS_AT } },
        { surface: 'row' }
      )
    }
  }
]
const divider: AgentJournalRenderItem = {
  itemId: agentJournalItemKey({ provider: 'orca', clientMessageId: 'account-switch:op' }),
  revision: 1,
  sequence: 3,
  observedAt: 7,
  turnScope: { kind: 'thread' },
  body: { kind: 'status', text: 'Account switched - b@example.com' }
}

const switching = { after: () => {} }

function Harness({
  items,
  isWorking
}: {
  items: AgentJournalRenderItem[]
  isWorking: boolean
}): React.JSX.Element {
  const sends = useStructuredAgentSessionSends({
    sessionId: 'chat',
    target: TARGET,
    fence: 1,
    submissions: [],
    queuedMessageIds: [],
    queue: {
      capability: 'unsupported',
      followUpsQueue: false,
      isWorking,
      stopping: false,
      session: {},
      prompts: []
    },
    historyLoaded: false
  })
  const transport: NativeChatStructuredComposerTransport = {
    capturePresentation: () => () => true,
    send: (text, images, request) =>
      sends.send(
        text,
        images.map((image) => ({ path: image.path, previewUri: image.path })),
        request
      ),
    onError: vi.fn(),
    dispatchCommand: async () => ({ handled: false, accepted: false, error: null }),
    optionsSurface: {
      getSnapshot: () => [],
      setOption: async () => ({ snapshot: [] }),
      invokeAction: async () => ({ snapshot: [] }),
      subscribe: () => () => {}
    },
    optionSnapshot: [],
    runtime: 'local',
    runtimeEnvironmentId: null,
    sessionId: 'chat'
  }
  const continuation = useNativeChatInterruptedContinuation({
    reportComposerError: vi.fn(),
    focusComposer: vi.fn(),
    target: TARGET,
    agent: 'claude',
    sessionId: 'chat',
    journalItems: items,
    submissions: [],
    isWorking,
    pending: sends.pending,
    transport
  })
  const account: NativeChatAccountSwitchView = {
    current: { id: 'b', label: 'b@example.com' },
    choices: [
      { id: 'b', label: 'b@example.com', disabled: false },
      { id: 'c', label: 'c@example.com', disabled: false }
    ],
    refresh: vi.fn(),
    switching: false,
    switchTo: async () => {
      switching.after()
      return true
    }
  }
  return (
    <TooltipProvider>
      <NativeChatUsageLimitActionsProvider
        recovery={{ readCurrent: true, canSwitchAccount: true }}
        chatAccountSwitch={account}
        view={continuation.view}
        pane={{
          tabId: 'tab',
          sessionId: 'chat',
          agent: 'claude',
          target: TARGET,
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
            failure: { kind: 'usageLimitReached', usageLimit: { resetsAt: RESETS_AT } },
            usageLimitTurnItemId: continuation.view.usageLimitTurnItemId ?? TURN
          }}
        />
      </NativeChatUsageLimitActionsProvider>
    </TooltipProvider>
  )
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

for (const mode of ['pinned', 'selection'] as const) {
  for (const working of [false, true]) {
    it(`sends the continuation once the chat moved (${mode}, working=${working})`, async () => {
      mocks.pinned = mode === 'pinned'
      const { rerender } = render(<Harness items={limitedChat} isWorking={false} />)
      switching.after = () =>
        rerender(<Harness items={[...limitedChat, divider]} isWorking={working} />)
      await chooseAccount('c@example.com')
      await waitFor(() => expect(mocks.call).toHaveBeenCalled())
      const sends = mocks.call.mock.calls.filter((call) => call[1] === 'agentSession.send')
      expect(sends).toHaveLength(1)
      expect(sends[0]![2]).toMatchObject({ usageLimitContinuationOfTurnItemId: TURN })
    })
  }
}
