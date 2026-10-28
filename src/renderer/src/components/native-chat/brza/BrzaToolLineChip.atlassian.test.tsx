// @vitest-environment happy-dom

import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NativeChatToolLine } from '../NativeChatToolLine'
import { NativeChatMarkdownImageOwnerContext } from '../native-chat-markdown-image-owner'
import type {
  NativeChatToolCallBlock,
  NativeChatToolResultBlock
} from '../../../../../shared/native-chat-types'

const mocks = vi.hoisted(() => ({
  openWebLink: vi.fn(),
  writeClipboardText: vi.fn(),
  jiraStatus: { connected: false, viewer: null } as {
    connected: boolean
    viewer: null
    activeSiteId?: string
    sites?: { id: string; siteUrl: string }[]
  }
}))

vi.mock('../native-chat-web-link-actions', () => ({ openNativeChatWebLink: mocks.openWebLink }))

vi.mock('../native-chat-link-target-actions', () => ({
  resolveNativeChatHttpLinkRouting: () => ({ sourceOwner: { kind: 'local' } })
}))

vi.mock('@/store', () => ({
  useAppStore: { getState: () => ({ jiraStatus: mocks.jiraStatus }) }
}))

type Owner = NonNullable<
  ComponentProps<typeof NativeChatMarkdownImageOwnerContext.Provider>['value']
>

const owner: Owner = {
  fileLinkContext: {
    worktreeId: 'wt-1',
    worktreePath: '/repo/wt-1',
    runtimeEnvironmentId: null,
    sourceTabId: 'chat-tab'
  },
  runtimeContext: null,
  isVisible: true
}

const JIRA_SITE_ID = 'a49b7870-7094-41f1-a120-46180349120a'

function jiraCall(cloudId: string): NativeChatToolCallBlock {
  return {
    type: 'tool-call',
    name: 'mcp__atlassian__getJiraIssue',
    input: { cloudId, issueIdOrKey: 'FIX-110' },
    state: 'completed',
    mcpIdentity: { server: 'atlassian', tool: 'getJiraIssue' }
  }
}

const jiraResult: NativeChatToolResultBlock = {
  type: 'tool-result',
  output: JSON.stringify({ data: { key: 'FIX-110', fields: { summary: 'Corrigir o orçamento' } } })
}

function renderLine(block: NativeChatToolCallBlock, result = jiraResult): void {
  render(
    <NativeChatMarkdownImageOwnerContext.Provider value={owner}>
      <NativeChatToolLine block={block} result={result} />
    </NativeChatMarkdownImageOwnerContext.Provider>
  )
}

beforeEach(() => {
  vi.stubGlobal('api', { ui: { writeClipboardText: mocks.writeClipboardText } })
  mocks.jiraStatus = { connected: false, viewer: null }
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  mocks.openWebLink.mockReset()
  mocks.writeClipboardText.mockReset()
})

describe('Jira and Confluence chips', () => {
  it('opens the issue on the cloudId domain without toggling the row', () => {
    renderLine(jiraCall('fixfy.atlassian.net'))

    expect(screen.getByText('FIX-110 — Corrigir o orçamento')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /FIX-110/ }))

    expect(mocks.openWebLink).toHaveBeenCalledWith(
      'https://fixfy.atlassian.net/browse/FIX-110',
      { worktreeId: 'wt-1', sourceTabId: 'chat-tab', sourceOwner: { kind: 'local' } },
      undefined
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
  })

  it("opens on the app's Jira site when the cloudId is an id", () => {
    mocks.jiraStatus = {
      connected: true,
      viewer: null,
      activeSiteId: 'site-1',
      sites: [{ id: 'site-1', siteUrl: 'https://fixfy.atlassian.net/' }]
    }
    renderLine(jiraCall(JIRA_SITE_ID))

    fireEvent.keyDown(screen.getByRole('link', { name: /FIX-110/ }), { key: 'Enter' })

    expect(mocks.openWebLink).toHaveBeenCalledWith(
      'https://fixfy.atlassian.net/browse/FIX-110',
      expect.anything(),
      undefined
    )
  })

  it('only copies the key when no site is known', () => {
    renderLine(jiraCall(JIRA_SITE_ID))

    fireEvent.click(screen.getByRole('link', { name: /FIX-110/ }))

    expect(mocks.openWebLink).not.toHaveBeenCalled()
    expect(mocks.writeClipboardText).toHaveBeenCalledWith('FIX-110')
  })

  it('shows a page chip that opens the Confluence page', () => {
    renderLine(
      {
        type: 'tool-call',
        name: 'mcp__atlassian__getConfluencePage',
        input: { cloudId: 'fixfy.atlassian.net', pageId: '21626881' },
        state: 'completed',
        mcpIdentity: { server: 'atlassian', tool: 'getConfluencePage' }
      },
      { type: 'tool-result', output: '{"data":{"id":"21626881","title":"Guia de deploy"}}' }
    )

    expect(screen.getByText('Guia de deploy')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: /página/ }))

    expect(mocks.openWebLink).toHaveBeenCalledWith(
      'https://fixfy.atlassian.net/wiki/pages/viewpage.action?pageId=21626881',
      expect.anything(),
      undefined
    )
  })
})
