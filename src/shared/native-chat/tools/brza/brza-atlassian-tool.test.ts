import { describe, expect, it } from 'vitest'
import { nativeChatToolIconName } from '../native-chat-tool-icon'
import { nativeChatToolLineLabel } from '../native-chat-tool-line-label'
import type { NativeChatToolCallBlock, NativeChatToolResultBlock } from '../../../native-chat-types'
import { brzaAtlassianChip, brzaAtlassianChipUrl } from './brza-atlassian-tool'

const identity = { server: 'atlassian', tool: 'getJiraIssue' }
const JIRA_SITE_ID = 'a49b7870-7094-41f1-a120-46180349120a'

function call(
  tool: string,
  input: unknown,
  mcpIdentity: { server: string; tool: string } = { server: 'atlassian', tool }
): NativeChatToolCallBlock {
  return {
    type: 'tool-call',
    name: `mcp__${mcpIdentity.server}__${tool}`,
    input,
    state: 'completed',
    mcpIdentity
  }
}

function output(value: unknown): NativeChatToolResultBlock {
  return { type: 'tool-result', output: typeof value === 'string' ? value : JSON.stringify(value) }
}

const issueOutput = output({
  data: {
    id: '10407',
    key: 'FIX-110',
    fields: {
      parent: { key: 'FIX-34', fields: { summary: 'Orçamento e Execução do Serviço' } },
      summary: 'Corrigir o orçamento'
    }
  }
})

describe('Atlassian MCP tool lines', () => {
  it('gives Jira calls the Jira logo and Confluence calls the file-text icon', () => {
    expect(nativeChatToolIconName('mcp__atlassian__getJiraIssue', identity)).toBe('jira-logo')
    expect(
      nativeChatToolIconName('mcp__atlassian__searchJiraIssuesUsingJql', {
        server: 'atlassian',
        tool: 'searchJiraIssuesUsingJql'
      })
    ).toBe('jira-logo')
    expect(
      nativeChatToolIconName('mcp__atlassian__getConfluencePage', {
        server: 'atlassian',
        tool: 'getConfluencePage'
      })
    ).toBe('file-text')
  })

  it('leaves non-Atlassian servers and Atlassian tools of neither product alone', () => {
    expect(
      nativeChatToolIconName('mcp__other__getJiraIssue', { server: 'other', tool: 'getJiraIssue' })
    ).not.toBe('jira-logo')
    const resources = { server: 'atlassian', tool: 'getAccessibleAtlassianResources' }
    expect(
      nativeChatToolIconName('mcp__atlassian__getAccessibleAtlassianResources', resources)
    ).not.toMatch(/jira-logo|file-text/)
  })

  describe('Jira title', () => {
    const input = { cloudId: JIRA_SITE_ID, issueIdOrKey: 'FIX-110' }

    it('is the key and the summary the output brings, never the parent summary', () => {
      const label = nativeChatToolLineLabel(call('getJiraIssue', input), issueOutput)
      expect(label).toMatchObject({
        target: 'FIX-110 — Corrigir o orçamento',
        title: 'FIX-110 — Corrigir o orçamento'
      })
    })

    it('is the key alone while there is no output, on an error and on a cut-off output', () => {
      expect(nativeChatToolLineLabel(call('getJiraIssue', input)).target).toBe('FIX-110')
      expect(
        nativeChatToolLineLabel(call('getJiraIssue', input), {
          type: 'tool-result',
          output: 'Error: not found',
          isError: true
        }).target
      ).toBe('FIX-110')
      const cut = output(issueOutput.output.slice(0, 80))
      expect(nativeChatToolLineLabel(call('getJiraIssue', input), cut).target).toBe('FIX-110')
    })

    it('reads the key from the output when the input names the issue by id', () => {
      const byId = { cloudId: JIRA_SITE_ID, issueIdOrKey: '10407' }
      expect(nativeChatToolLineLabel(call('getJiraIssue', byId), issueOutput).target).toBe(
        'FIX-110 — Corrigir o orçamento'
      )
      expect(nativeChatToolLineLabel(call('getJiraIssue', byId)).target).not.toContain('FIX-')
    })

    it('keeps the upstream wording for a call that names no issue', () => {
      const search = call('searchJiraIssuesUsingJql', {
        cloudId: JIRA_SITE_ID,
        jql: 'project = FIX'
      })
      const label = nativeChatToolLineLabel(search, output({ data: { issues: [] } }))
      expect(label.target).not.toContain('—')
      expect(label.target).toContain('project = FIX')
    })
  })

  describe('Confluence title', () => {
    const page = (tool: string, input: unknown): NativeChatToolCallBlock => call(tool, input)

    it('is the page title from data.title or data.content.title', () => {
      expect(
        nativeChatToolLineLabel(
          page('getConfluencePage', { cloudId: JIRA_SITE_ID, pageId: '21626881' }),
          output({ data: { id: '21626881', title: 'Guia de deploy' } })
        )
      ).toMatchObject({ target: 'Guia de deploy', title: 'Guia de deploy' })
      expect(
        nativeChatToolLineLabel(
          page('createConfluenceContent', { cloudId: JIRA_SITE_ID, title: 'Rascunho' }),
          output({ data: { ok: true, content: { id: '1', title: 'Sonda — página' } } })
        ).target
      ).toBe('Sonda — página')
    })

    it('falls back to the input title, and keeps upstream wording when there is none', () => {
      expect(
        nativeChatToolLineLabel(
          page('createConfluenceContent', { cloudId: JIRA_SITE_ID, title: 'Rascunho' })
        ).target
      ).toBe('Rascunho')
      const search = page('searchConfluence', { cloudId: JIRA_SITE_ID, cql: 'type = space' })
      expect(
        nativeChatToolLineLabel(search, output({ data: { results: [{ title: 'Templates' }] } }))
          .target
      ).not.toBe('Templates')
    })
  })

  describe('chip', () => {
    it('opens the issue on the site the cloudId names when it is a domain', () => {
      const chip = brzaAtlassianChip(
        call('getJiraIssue', { cloudId: 'fixfy.atlassian.net', issueIdOrKey: 'FIX-110' })
      )
      expect(chip).toMatchObject({ label: 'FIX-110', target: { copyText: 'FIX-110' } })
      expect(brzaAtlassianChipUrl(chip!.target, null)).toBe(
        'https://fixfy.atlassian.net/browse/FIX-110'
      )
    })

    it('takes the host of a cloudId that is a URL', () => {
      const chip = brzaAtlassianChip(
        call('getJiraIssue', { cloudId: 'https://fixfy.atlassian.net/jira', issueIdOrKey: 'FIX-1' })
      )
      expect(brzaAtlassianChipUrl(chip!.target, null)).toBe(
        'https://fixfy.atlassian.net/browse/FIX-1'
      )
    })

    it("falls back to the app's Jira site when the cloudId is an id, and only copies without one", () => {
      const chip = brzaAtlassianChip(
        call('getJiraIssue', { cloudId: JIRA_SITE_ID, issueIdOrKey: 'FIX-110' })
      )
      expect(brzaAtlassianChipUrl(chip!.target, 'https://fixfy.atlassian.net/')).toBe(
        'https://fixfy.atlassian.net/browse/FIX-110'
      )
      expect(brzaAtlassianChipUrl(chip!.target, null)).toBeNull()
      expect(chip?.target.copyText).toBe('FIX-110')
    })

    it('ignores a cloudId domain that would not be a plain host', () => {
      const chip = brzaAtlassianChip(
        call('getJiraIssue', { cloudId: 'evil.com/x?y=', issueIdOrKey: 'FIX-110' })
      )
      expect(brzaAtlassianChipUrl(chip!.target, null)).toBeNull()
    })

    it('opens a Confluence page by the output URL when both parts come', () => {
      const chip = brzaAtlassianChip(
        call('createConfluenceContent', { cloudId: JIRA_SITE_ID, title: 'Sonda' }),
        output({
          data: {
            content: {
              id: '21626881',
              title: 'Sonda',
              webUrl: '/spaces/~71/pages/21626881/Sonda',
              baseUrl: 'https://fixfy.atlassian.net/wiki'
            }
          }
        })
      )
      expect(brzaAtlassianChipUrl(chip!.target, null)).toBe(
        'https://fixfy.atlassian.net/wiki/spaces/~71/pages/21626881/Sonda'
      )
    })

    it('builds the Confluence URL from the page id on the cloudId or app site', () => {
      const withDomain = brzaAtlassianChip(
        call('getConfluencePage', { cloudId: 'fixfy.atlassian.net', pageId: '21626881' }),
        output({ data: { id: '21626881', title: 'Guia' } })
      )
      expect(brzaAtlassianChipUrl(withDomain!.target, null)).toBe(
        'https://fixfy.atlassian.net/wiki/pages/viewpage.action?pageId=21626881'
      )
      const withId = brzaAtlassianChip(
        call('getConfluencePage', { cloudId: JIRA_SITE_ID, pageId: '21626881' }),
        output({ data: { id: '21626881', title: 'Guia' } })
      )
      expect(brzaAtlassianChipUrl(withId!.target, 'https://fixfy.atlassian.net')).toBe(
        'https://fixfy.atlassian.net/wiki/pages/viewpage.action?pageId=21626881'
      )
      expect(brzaAtlassianChipUrl(withId!.target, null)).toBeNull()
      expect(withId?.target.copyText).toBe('21626881')
    })

    it('has no chip for calls that name no issue or page', () => {
      expect(
        brzaAtlassianChip(call('searchJiraIssuesUsingJql', { cloudId: JIRA_SITE_ID, jql: 'x' }))
      ).toBeNull()
      expect(
        brzaAtlassianChip(call('getJiraIssue', { cloudId: 'x.atlassian.net' }), undefined)
      ).toBeNull()
    })
  })
})
