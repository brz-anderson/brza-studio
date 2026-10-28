import { describe, expect, it } from 'vitest'
import { nativeChatToolIconName } from '../native-chat-tool-icon'
import { nativeChatToolLineLabel } from '../native-chat-tool-line-label'
import type { NativeChatToolCallBlock, NativeChatToolResultBlock } from '../../../native-chat-types'
import { brzaToolLineChip } from './brza-tool-line-chip'

function bash(command: string): NativeChatToolCallBlock {
  return { type: 'tool-call', name: 'Bash', input: { command }, state: 'completed' }
}

function output(text: string, isError = false): NativeChatToolResultBlock {
  return { type: 'tool-result', output: text, isError }
}

const PR_URL = 'https://github.com/brz-anderson/brza-studio/pull/123'

describe('a shell call to gh pr or gh issue', () => {
  it('draws the pull request glyph, outweighing git in a compound', () => {
    expect(nativeChatToolIconName('Bash', undefined, { command: 'gh pr view 123' })).toBe(
      'git-pull-request'
    )
    expect(
      nativeChatToolIconName('Bash', undefined, { command: 'git push -u origin x && gh pr create' })
    ).toBe('git-pull-request')
    expect(nativeChatToolIconName('Bash', undefined, { command: 'gh issue list' })).toBe(
      'git-pull-request'
    )
    expect(nativeChatToolIconName('Bash', undefined, { command: 'gh run list' })).toBe(
      'square-terminal'
    )
  })

  it('titles a created PR with the number from the output URL and the --title', () => {
    const call = bash(`gh pr create --title "feat: chips" --body "x"`)
    expect(nativeChatToolLineLabel(call, output(`${PR_URL}\n`))).toMatchObject({
      target: 'PR #123 — feat: chips',
      title: `gh pr create --title "feat: chips" --body "x"`
    })
  })

  it('reads the title from gh view output, plain or JSON', () => {
    const plain = output(
      `title:\tfix: the row\nstate:\tOPEN\nnumber:\t45\nurl:\thttps://github.com/o/r/issues/45\n`
    )
    expect(nativeChatToolLineLabel(bash('gh issue view 45'), plain).target).toBe(
      'Issue #45 — fix: the row'
    )
    const json = output(`{"title":"feat: \\"quoted\\"","url":"${PR_URL}"}`)
    expect(nativeChatToolLineLabel(bash('gh pr view 123 --json title,url'), json).target).toBe(
      'PR #123 — feat: "quoted"'
    )
  })

  it('names the number alone without a title, and keeps the command without a number', () => {
    expect(nativeChatToolLineLabel(bash('gh pr merge 123 --squash'), output(PR_URL)).target).toBe(
      'PR #123'
    )
    expect(nativeChatToolLineLabel(bash('gh pr create -t "feat: chips"')).target).toBe(
      'gh pr create -t "feat: chips"'
    )
    expect(nativeChatToolLineLabel(bash('gh pr list'), output('123\tfeat\tx\tOPEN')).target).toBe(
      'gh pr list'
    )
  })

  it('offers the number as a chip that opens the URL', () => {
    expect(brzaToolLineChip(bash('gh pr create -t x'), output(`Creating…\n${PR_URL}\n`))).toEqual({
      label: '#123',
      target: { kind: 'url', url: PR_URL }
    })
    expect(brzaToolLineChip(bash('gh pr create -t x'))).toBeNull()
    expect(
      brzaToolLineChip(bash('gh issue view 7'), output('https://github.com/o/r/pull/9'))
    ).toBeNull()
  })
})
