import { defineFixture } from '../../component-fixtures/component-fixture'
import { useAppStore } from '@/store'
import { makeFolderWorkspace } from '@/components/quick-open-file-list-test-harness'
import { NativeChatComposerActions } from './composer/controls/NativeChatComposerActions'
import { NativeChatContextUsageRing } from './usage/NativeChatContextUsageRing'
import { NativeChatEmptyState } from './host-access/NativeChatEmptyState'
import { NativeChatPaneHeader } from './pane/actions/NativeChatPaneHeader'
import { NativeChatTurnActivityLine } from './messages/reasoning/NativeChatTurnActivityLine'
import { nativeChatThemeSurfaceStyle } from '@/lib/native-chat-theme-surface-style'
import type { NativeChatTheme } from '../../../../shared/native-chat-theme'
import { nativeChatAppearanceStyle } from './appearance/native-chat-appearance-style'

function Frame({ children, tall = false }: { children: React.ReactNode; tall?: boolean }) {
  return (
    <div
      className="native-chat-appearance relative bg-chat-canvas p-4"
      style={{ ...nativeChatAppearanceStyle({}), height: tall ? 320 : undefined }}
    >
      {children}
    </div>
  )
}

function usage(percentage: number) {
  return {
    usedTokens: percentage * 2000,
    windowTokens: 200_000,
    percentage,
    estimated: false,
    rows: []
  }
}

function Composer({ withText = false }: { withText?: boolean }) {
  return (
    <div className="rounded-xl border border-chat-composer-border p-1.5 shadow-xs bg-chat-composer-surface brza-composer-focus [contain:paint]">
      <textarea
        data-testid="brand-composer"
        className="block w-full resize-none bg-transparent p-2 text-sm outline-none"
        rows={2}
        defaultValue={withText ? 'Ship it' : ''}
        placeholder="Message the agent"
      />
      <NativeChatComposerActions
        attachDisabled={false}
        dictationDisabled
        sendDisabled={false}
        isWorking={false}
        isDictating={false}
        isDictationHoldMode={false}
        onAttach={() => {}}
        onDictationToggle={() => {}}
        onDictationHoldStart={() => {}}
        onDictationHoldEnd={() => {}}
        onSend={() => {}}
        onStop={() => {}}
        sessionOptionsSurface={null}
        sessionOptionsSnapshot={[]}
      />
    </div>
  )
}

export const emptyState = defineFixture({
  width: 560,
  render: () => (
    <Frame tall>
      <NativeChatEmptyState kind="empty" agent="claude" />
    </Frame>
  )
})

export const emptyStateError = defineFixture({
  width: 560,
  render: () => (
    <Frame tall>
      <NativeChatEmptyState kind="error" />
    </Frame>
  )
})

export const composerRest = defineFixture({
  width: 560,
  render: () => (
    <Frame>
      <Composer />
    </Frame>
  )
})

export const composerFocus = defineFixture({
  width: 560,
  render: () => (
    <Frame>
      <Composer withText />
    </Frame>
  ),
  interact: (frame) => {
    frame.querySelector<HTMLTextAreaElement>('[data-testid="brand-composer"]')?.focus()
  }
})

export const activityLine = defineFixture({
  width: 560,
  render: () => (
    <Frame>
      <NativeChatTurnActivityLine
        line={{ thinking: false, stopping: false, activityText: null, reasoning: null }}
      />
    </Frame>
  )
})

export const rings = defineFixture({
  width: 320,
  render: () => (
    <Frame>
      <div className="flex gap-4">
        <NativeChatContextUsageRing usage={usage(25)} />
        <NativeChatContextUsageRing usage={usage(60)} />
        <NativeChatContextUsageRing usage={usage(89)} />
        <NativeChatContextUsageRing usage={usage(95)} />
      </div>
    </Frame>
  )
})

let headerIds: { tabId: string; worktreeId: string; groupId: string; sessionId: string } | null =
  null

function setupHeader(): void {
  useAppStore.setState({
    folderWorkspaces: [makeFolderWorkspace({ id: 'workspace', folderPath: '/repo' })]
  })
  const tab = useAppStore.getState().createUnifiedTab('folder:workspace', 'agent-session', {
    agentSessionAgent: 'codex'
  })
  headerIds = {
    tabId: tab.id,
    worktreeId: tab.worktreeId,
    groupId: tab.groupId,
    sessionId: tab.entityId
  }
}

function Headers() {
  if (!headerIds) {
    return null
  }
  return (
    <div className="flex flex-col gap-6">
      {[true, false].map((focused) => (
        <div key={String(focused)} className="relative h-8 bg-chat-canvas">
          <NativeChatPaneHeader
            {...headerIds!}
            nativeChat={{ sessionId: headerIds!.sessionId, agent: 'codex' }}
            focused={focused}
            colorScheme={undefined}
          />
        </div>
      ))}
    </div>
  )
}

export const paneHeader = defineFixture({
  width: 560,
  setup: setupHeader,
  render: () => (
    <Frame>
      <Headers />
    </Frame>
  )
})

// A catalog chat theme is the one case where the chat's scheme differs from the app's.
function catalogChatTheme(scheme: 'dark' | 'light'): NativeChatTheme {
  const light = scheme === 'light'
  const background = light ? '#fdf6e3' : '#1e1e2e'
  const foreground = light ? '#073642' : '#cdd6f4'
  return {
    themeName: 'fixture',
    scheme,
    followsAppScheme: false,
    background,
    foreground,
    palette: { background, foreground },
    canvas: background,
    canvasMix: 0,
    foregroundMix: light ? 82 : 78,
    strongMix: light ? 92 : 90,
    text: foreground
  }
}

function OppositeSchemeFrame() {
  const appIsDark = document.documentElement.classList.contains('dark')
  const scheme = appIsDark ? 'light' : 'dark'
  return (
    <div
      className="native-chat-appearance relative bg-chat-canvas p-4"
      data-native-chat-scheme={scheme}
      style={{
        ...nativeChatAppearanceStyle({}),
        ...nativeChatThemeSurfaceStyle(catalogChatTheme(scheme))
      }}
    >
      <Composer withText />
    </div>
  )
}

export const composerFocusOppositeScheme = defineFixture({
  width: 560,
  render: () => <OppositeSchemeFrame />,
  interact: (frame) => {
    frame.querySelector<HTMLTextAreaElement>('[data-testid="brand-composer"]')?.focus()
  }
})
