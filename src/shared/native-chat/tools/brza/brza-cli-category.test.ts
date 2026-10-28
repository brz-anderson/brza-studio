import { describe, expect, it } from 'vitest'
import {
  nativeChatToolCategory,
  nativeChatToolIconName,
  nativeChatToolRunIconName
} from '../native-chat-tool-icon'

function bash(command: string) {
  return { name: 'Bash', input: { command } }
}

describe('a shell call to the CLI', () => {
  it('draws the BrzA flame, under either launcher name, and stays a command', () => {
    expect(nativeChatToolIconName('Bash', undefined, { command: 'brza worktree list' })).toBe(
      'brza-logo'
    )
    expect(
      nativeChatToolIconName('shell', undefined, {
        command: "/bin/zsh -lc 'cd app && orca terminal read --terminal t1'"
      })
    ).toBe('brza-logo')
    expect(nativeChatToolCategory('Bash', undefined, { command: 'brza worktree list' })).toBe(
      'unknown'
    )
  })

  it('keeps the globe for a browser command and the terminal for anything else', () => {
    expect(nativeChatToolIconName('Bash', undefined, { command: 'brza snapshot' })).toBe('globe')
    expect(nativeChatToolIconName('Bash', undefined, { command: 'echo brza' })).toBe(
      'square-terminal'
    )
    expect(nativeChatToolIconName('Read', undefined, { file_path: '/usr/local/bin/brza' })).toBe(
      'eye'
    )
  })

  it('gives a run the flame only when every command in it calls the CLI', () => {
    const run = [bash('brza worktree list'), bash('orca orchestration check')]

    expect(nativeChatToolRunIconName(run)).toBe('brza-logo')
    expect(nativeChatToolRunIconName([...run, bash('git status')])).toBe('square-terminal')
  })
})
