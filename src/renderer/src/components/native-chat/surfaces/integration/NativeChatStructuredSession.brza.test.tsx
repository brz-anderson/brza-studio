import * as nativeChatTheme from '../../../../../../shared/native-chat-theme'
import { getDefaultSettings } from '../../../../../../shared/orca-profiles/constants'
// @vitest-environment happy-dom

import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '../../../../store/index'

const { moduleFactories, resetStructuredSessionMocks } = await vi.hoisted(async () =>
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
    expect(root?.style.getPropertyValue('--chat-font-family')).toContain('system-ui')
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
    expect(root?.style.getPropertyValue('--chat-font-family')).toContain('system-ui')
    expect(root?.style.getPropertyValue('--chat-foreground-mix')).toBe('78%')
    expect(root?.style.getPropertyValue('--chat-font-size')).toBe('13px')
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
})
