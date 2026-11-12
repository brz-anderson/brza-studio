import * as nativeChatTheme from '../../../../../../shared/native-chat-theme'
import { getDefaultSettings } from '../../../../../../shared/constants'
// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../../../store/index'

const { mocks, moduleFactories, resetStructuredSessionMocks } = await vi.hoisted(async () =>
  (await import('./NativeChatStructuredSession.test-harness')).createStructuredSessionMocks()
)

vi.mock('../../../../runtime/native-chat/requests/structured-agent-session-call', () =>
  moduleFactories.structuredAgentSessionCall()
)
vi.mock('../../../../runtime/native-chat/requests/structured-agent-session-subscriptions', () =>
  moduleFactories.structuredAgentSessionSubscriptions()
)
vi.mock('../../session/structured/use-structured-agent-session', () =>
  moduleFactories.useStructuredAgentSession()
)
vi.mock('../../appearance/use-native-chat-font-size', () => moduleFactories.useNativeChatFontSize())
vi.mock('../../links/actions/use-native-chat-file-link-context', () =>
  moduleFactories.useNativeChatFileLinkContext()
)
vi.mock('../../pane/ownership/use-native-chat-tab-owner', () =>
  moduleFactories.useNativeChatTabOwner()
)
vi.mock('../../links/actions/use-native-chat-file-link-click', () =>
  moduleFactories.useNativeChatFileLinkClick()
)
vi.mock('../../NativeChatMessageList', () => moduleFactories.nativeChatMessageList())
vi.mock('../../composer/NativeChatComposer', () => moduleFactories.nativeChatComposer())
vi.mock('../../host-access/NativeChatEmptyState', () => moduleFactories.nativeChatEmptyState())
vi.mock('../../prompts/NativeChatApprovalCard', () => moduleFactories.nativeChatApprovalCard())
vi.mock('../../prompts/NativeChatQuestionCard', () => moduleFactories.nativeChatQuestionCard())

import { NativeChatStructuredSession } from '../../NativeChatStructuredSession'

describe('NativeChatStructuredSession', () => {
  it('applies persisted appearance at the chat root and updates it live', () => {
    const original = useAppStore.getState().settings
    useAppStore.setState({
      settings: {
        ...getDefaultSettings('/tmp'),
        theme: 'dark',
        nativeChatAppearance: {
          fontSize: 18,
          codeFontSize: 11,
          width: 'wide',
          themeDark: 'Ghostty Default Style Dark',
          contrast: 120
        },
        terminalFontFamily: 'Consolas',
        terminalFontSize: 16
      }
    })
    const { container } = render(
      <NativeChatStructuredSession
        isVisible
        isFocusedGroup
        tabId="appearance-tab"
        sessionId="appearance-session"
        target={{ kind: 'local' }}
        agent="codex"
      />
    )
    const root = container.querySelector<HTMLElement>('[data-native-chat-root]')
    expect(root?.style.colorScheme).toBe('dark')
    expect(root?.style.color).toBe('var(--foreground)')
    expect(root?.dataset.nativeChatScheme).toBe('dark')
    expect(root?.style.getPropertyValue('--chat-source-background')).toBe('#282c34')
    expect(root?.style.getPropertyValue('--chat-source-foreground')).toBe('#ffffff')
    expect(root?.style.getPropertyValue('--chat-code-font-family')).toContain('Consolas')
    expect(root?.style.getPropertyValue('--chat-font-family')).toBe('')
    expect(root?.style.getPropertyValue('--chat-foreground-mix')).toBe('86.8%')
    expect(root?.style.getPropertyValue('--chat-font-size')).toBe('18px')
    expect(root?.style.getPropertyValue('--chat-code-font-size')).toBe('11px')
    expect(root?.style.getPropertyValue('--chat-content-max-width')).toBe('60rem')
    act(() =>
      useAppStore.setState({
        settings: {
          ...getDefaultSettings('/tmp'),
          theme: 'dark',
          nativeChatAppearance: { width: 'full' }
        }
      })
    )
    expect(root?.style.colorScheme).toBe('')
    expect(root?.style.color).toBe('')
    expect(root?.dataset.nativeChatScheme).toBeUndefined()
    expect(root?.style.getPropertyValue('--chat-source-background')).toBe('')
    expect(root?.style.getPropertyValue('--chat-source-foreground')).toBe('')
    expect(root?.style.getPropertyValue('--chat-font-family')).toBe('')
    expect(root?.style.getPropertyValue('--chat-foreground-mix')).toBe('78%')
    expect(root?.style.getPropertyValue('--chat-font-size')).toBe('14px')
    expect(root?.style.getPropertyValue('--chat-content-max-width')).toBe('none')
    act(() => useAppStore.setState({ settings: original }))
  })

  it('skips appearance work on unrelated settings writes and updates the root for appearance changes', () => {
    const original = useAppStore.getState().settings
    const settings = {
      ...getDefaultSettings('/tmp'),
      theme: 'dark' as const,
      nativeChatAppearance: { themeDark: 'Ghostty Default Style Dark' }
    }
    useAppStore.setState({ settings })
    const resolveTheme = vi.spyOn(nativeChatTheme, 'resolveNativeChatTheme')
    const view = render(
      <NativeChatStructuredSession
        isVisible
        isFocusedGroup
        tabId="appearance-subscription-tab"
        sessionId="appearance-subscription-session"
        target={{ kind: 'local' }}
        agent="codex"
      />
    )
    const initialResolutions = resolveTheme.mock.calls.length
    act(() =>
      useAppStore.setState({
        settings: { ...settings, terminalFontSize: settings.terminalFontSize + 1 }
      })
    )
    expect(resolveTheme).toHaveBeenCalledTimes(initialResolutions)
    act(() =>
      useAppStore.setState({
        settings: {
          ...settings,
          nativeChatAppearance: { ...settings.nativeChatAppearance, fontSize: 17 }
        }
      })
    )
    expect(resolveTheme).toHaveBeenCalledTimes(initialResolutions + 1)
    expect(
      view.container
        .querySelector<HTMLElement>('[data-native-chat-root]')
        ?.style.getPropertyValue('--chat-font-size')
    ).toBe('17px')
    act(() => useAppStore.setState({ settings: { ...settings, terminalFontFamily: 'Menlo' } }))
    expect(resolveTheme).toHaveBeenCalledTimes(initialResolutions + 2)
    expect(
      view.container
        .querySelector<HTMLElement>('[data-native-chat-root]')
        ?.style.getPropertyValue('--chat-code-font-family')
    ).toContain('Menlo')
    view.unmount()
    useAppStore.setState({ settings: original })
  })

  afterEach(() => {
    cleanup()
    resetStructuredSessionMocks()
    vi.restoreAllMocks()
  })

  // Create fresh elements for rerenders; React can skip an identical element.
  const claudeSessionView = (tabId: string, sessionId: string) => (
    <NativeChatStructuredSession
      isVisible
      isFocusedGroup
      tabId={tabId}
      sessionId={sessionId}
      target={{ kind: 'local' }}
      agent="claude"
    />
  )

  it('places background monitoring above the usable composer, keeps its list open across a gap in live work, and stops without an active turn', async () => {
    mocks.monitoringBackgroundTasks = true
    mocks.supportsBackgroundTaskStop = true
    mocks.backgroundTasks = [
      { id: 'task-command', kind: 'command', description: 'sleep 180' },
      { id: 'task-agent', kind: 'agent' }
    ]
    mocks.stopBackgroundTask.mockResolvedValue({ cancelled: true })

    const { rerender } = render(
      claudeSessionView('structured-tab-background', 'session-background')
    )

    const disclosure = screen.getByRole('button', { name: '1 agent · 1 shell' })
    const status = disclosure.closest('[data-native-chat-background-tasks="true"]')
    const composer = screen.getByTestId('structured-composer')
    if (!status) {
      throw new Error('background task status was not rendered')
    }
    expect(status.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(mocks.composerProps?.isWorking).toBe(false)
    expect(screen.queryByRole('list', { name: 'Agents' })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Stop / })).toBeNull()

    expect(disclosure.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(disclosure)
    expect(disclosure.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('list', { name: 'Agents' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Shell' })).toBeTruthy()
    expect(screen.getByText('sleep 180')).toBeTruthy()
    expect(screen.getByText('Background agent')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Stop sleep 180' }))
    await waitFor(() =>
      expect(mocks.stopBackgroundTask).toHaveBeenCalledWith('session-background', 'task-command')
    )

    // The strip unmounts between sequential child runs; its disclosure must survive those gaps.
    mocks.monitoringBackgroundTasks = false
    rerender(claudeSessionView('structured-tab-background', 'session-background'))
    expect(document.querySelector('[data-native-chat-background-tasks="true"]')).toBeNull()
    mocks.monitoringBackgroundTasks = true
    rerender(claudeSessionView('structured-tab-background', 'session-background'))
    expect(screen.getByRole('list', { name: 'Agents' })).toBeTruthy()
  })

  it('tracks concurrent task stops independently: a confirmed one holds its row, a failed one clears', async () => {
    mocks.monitoringBackgroundTasks = true
    mocks.supportsBackgroundTaskStop = true
    mocks.backgroundTasks = [
      { id: 'task-one', kind: 'command', description: 'First task' },
      { id: 'task-two', kind: 'command', description: 'Second task' }
    ]
    let finishFirst!: (value: unknown) => void
    let finishSecond!: (value: unknown) => void
    mocks.stopBackgroundTask.mockImplementation(
      (_sessionId: string, taskId?: string) =>
        new Promise((resolve) => {
          if (taskId === 'task-one') {
            finishFirst = resolve
          } else {
            finishSecond = resolve
          }
        })
    )

    const { rerender } = render(
      claudeSessionView('structured-tab-concurrent-background', 'session-concurrent-background')
    )
    fireEvent.click(screen.getByRole('button', { name: '2 shells — 2 working' }))
    const firstStop = screen.getByRole('button', { name: 'Stop First task' })
    const secondStop = screen.getByRole('button', { name: 'Stop Second task' })

    fireEvent.click(firstStop)
    fireEvent.click(secondStop)
    expect((firstStop as HTMLButtonElement).disabled).toBe(true)
    expect((secondStop as HTMLButtonElement).disabled).toBe(true)

    // Confirmed before its row leaves: the button stays in its stopping state, never Stop again.
    await act(async () => finishFirst({ cancelled: true }))
    expect((firstStop as HTMLButtonElement).disabled).toBe(true)
    expect((secondStop as HTMLButtonElement).disabled).toBe(true)

    await act(async () => finishSecond(null))
    await waitFor(() => expect((secondStop as HTMLButtonElement).disabled).toBe(false))
    expect((firstStop as HTMLButtonElement).disabled).toBe(true)

    mocks.backgroundTasks = [{ id: 'task-two', kind: 'command', description: 'Second task' }]
    rerender(
      claudeSessionView('structured-tab-concurrent-background', 'session-concurrent-background')
    )
    expect(screen.queryByRole('button', { name: 'Stop First task' })).toBeNull()
    // The same task listed again is one the Stop did not end.
    mocks.backgroundTasks = [
      { id: 'task-one', kind: 'command', description: 'First task' },
      { id: 'task-two', kind: 'command', description: 'Second task' }
    ]
    rerender(
      claudeSessionView('structured-tab-concurrent-background', 'session-concurrent-background')
    )
    const firstAgain = screen.getByRole('button', { name: 'Stop First task' })
    expect(firstAgain.hasAttribute('disabled')).toBe(false)
  })

  it('keeps a stale session stop result from clearing the current session pending state', async () => {
    mocks.monitoringBackgroundTasks = true
    mocks.supportsBackgroundTaskStop = true
    mocks.backgroundTasks = [{ id: 'task-one', kind: 'command', description: 'Shared task' }]
    let finishOld!: (value: unknown) => void
    let finishCurrent!: (value: unknown) => void
    mocks.stopBackgroundTask.mockImplementation(
      (sessionId: string) =>
        new Promise((resolve) => {
          if (sessionId === 'session-old') {
            finishOld = resolve
          } else {
            finishCurrent = resolve
          }
        })
    )
    const { rerender } = render(claudeSessionView('structured-tab-stale-background', 'session-old'))
    fireEvent.click(screen.getByRole('button', { name: '1 shell command — working' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stop Shared task' }))

    rerender(claudeSessionView('structured-tab-stale-background', 'session-current'))
    fireEvent.click(screen.getByRole('button', { name: '1 shell command — working' }))
    const currentStop = screen.getByRole('button', { name: 'Stop Shared task' })
    expect((currentStop as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(currentStop)
    expect((currentStop as HTMLButtonElement).disabled).toBe(true)

    await act(async () => finishOld({ cancelled: true }))
    expect((currentStop as HTMLButtonElement).disabled).toBe(true)
    await act(async () => finishCurrent({ cancelled: false }))
    await waitFor(() => expect((currentStop as HTMLButtonElement).disabled).toBe(false))
  })
})
