import { describe, expect, it } from 'vitest'
import { parseOrcaBrowserCommand, runsOrcaCliCommand } from './orca-browser-cli-commands'

describe('parseOrcaBrowserCommand', () => {
  it.each([
    // BrzA's own command name reaches the same browser tab.
    ['brza snapshot --page p5', 'p5']
  ])('matches %s', (command, pageId) => {
    expect(parseOrcaBrowserCommand(command)).toEqual({ pageId })
  })

  it.each([
    'orca worktree ls',
    'orca terminal send --text "orca click"',
    'orcastra click',
    'orca',
    'echo orca click',
    'echo "docs; orca snapshot --page p1; text"',
    "git commit -m 'run orca click | orca snapshot'",
    'git log --oneline'
  ])('does not match %s', (command) => {
    expect(parseOrcaBrowserCommand(command)).toBeNull()
  })
})

describe('runsOrcaCliCommand', () => {
  it.each([
    'brza worktree list',
    'orca worktree ls',
    'brza',
    '/usr/local/bin/brza terminal read --terminal t1',
    'C:\\Users\\me\\bin\\brza.cmd status',
    'cd app && BRZA_X=1 brza orchestration ask',
    'orca-dev snapshot'
  ])('matches %s', (command) => {
    expect(runsOrcaCliCommand(command)).toBe(true)
  })

  it.each([
    'echo brza worktree list',
    'git commit -m "brza worktree list"',
    'brzastudio status',
    'cat ~/.orca/brza.json',
    'git log --oneline'
  ])('does not match %s', (command) => {
    expect(runsOrcaCliCommand(command)).toBe(false)
  })
})
