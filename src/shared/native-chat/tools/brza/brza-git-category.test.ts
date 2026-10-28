import { describe, expect, it } from 'vitest'
import { nativeChatToolIconName, nativeChatToolRunIconName } from '../native-chat-tool-icon'
import { nativeChatToolLineLabel } from '../native-chat-tool-line-label'
import type { NativeChatToolCallBlock, NativeChatToolResultBlock } from '../../../native-chat-types'
import { brzaToolLineChip } from './brza-tool-line-chip'

function bash(command: string): NativeChatToolCallBlock {
  return { type: 'tool-call', name: 'Bash', input: { command }, state: 'completed' }
}

function output(text: string, isError = false): NativeChatToolResultBlock {
  return { type: 'tool-result', output: text, isError }
}

const HEREDOC_COMMIT = `git add -A && git commit -m "$(cat <<'EOF'
feat(native-chat): git gets its logo

Body line.
EOF
)"`

describe('a shell call to git', () => {
  it('draws the git logo, and the commit glyph on a commit', () => {
    expect(nativeChatToolIconName('Bash', undefined, { command: 'git status' })).toBe('git-logo')
    expect(nativeChatToolIconName('Bash', undefined, { command: 'git -C app log -3' })).toBe(
      'git-logo'
    )
    expect(nativeChatToolIconName('Bash', undefined, { command: HEREDOC_COMMIT })).toBe(
      'git-commit-horizontal'
    )
    expect(nativeChatToolIconName('Bash', undefined, { command: 'echo "git commit"' })).toBe(
      'square-terminal'
    )
  })

  it('outweighs the CLI flame in a compound, and yields to the browser globe', () => {
    expect(
      nativeChatToolIconName('Bash', undefined, { command: 'brza worktree list && git status' })
    ).toBe('git-logo')
    expect(
      nativeChatToolIconName('Bash', undefined, { command: 'brza snapshot && git status' })
    ).toBe('globe')
  })

  it('gives a run of git calls the logo, even with a commit inside', () => {
    expect(
      nativeChatToolRunIconName([bash('git status'), bash('git diff'), bash('git commit -m x')])
    ).toBe('git-logo')
  })

  it('titles a commit with the first line of its message, keeping the command as tooltip', () => {
    const label = nativeChatToolLineLabel(bash('git commit -am "fix: the row" -m "body"'))
    expect(label).toMatchObject({
      target: 'git commit — fix: the row',
      title: 'git commit -am "fix: the row" -m "body"'
    })
    expect(nativeChatToolLineLabel(bash(HEREDOC_COMMIT)).target).toBe(
      'git commit — feat(native-chat): git gets its logo'
    )
  })

  it('reads the subject from the output when the input carries no message', () => {
    const result = output('[main 1a2b3c4] chore: amended subject\n 1 file changed')
    expect(nativeChatToolLineLabel(bash('git commit --amend --no-edit'), result).target).toBe(
      'git commit — chore: amended subject'
    )
    expect(nativeChatToolLineLabel(bash('git commit --amend --no-edit')).target).toBe(
      'git commit --amend --no-edit'
    )
  })

  it('keeps the command text for any other git subcommand', () => {
    expect(nativeChatToolLineLabel(bash('git status --short')).target).toBe('git status --short')
  })

  it('offers the short hash from the commit output as a chip that opens the commit', () => {
    const call = bash('git commit -m "x"')
    expect(
      brzaToolLineChip(call, output('[feat/abc (root-commit) 9f8e7d6] x\n 2 files changed'))
    ).toEqual({ label: '9f8e7d6', target: { kind: 'commit', hash: '9f8e7d6', subject: 'x' } })
    expect(brzaToolLineChip(call)).toBeNull()
    expect(brzaToolLineChip(call, output('husky - pre-commit hook exited with code 1', true))).toBe(
      null
    )
    expect(brzaToolLineChip(bash('git log -1'), output('[main 9f8e7d6] x'))).toBeNull()
  })
})
