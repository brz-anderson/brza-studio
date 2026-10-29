import { describe, expect, it } from 'vitest'
import { nativeChatToolIconName } from '../native-chat-tool-icon'
import { nativeChatToolLineLabel } from '../native-chat-tool-line-label'
import { summarizeToolInput } from '../native-chat-tool-summary'
import type { NativeChatToolCallBlock } from '../../../native-chat-types'

function call(
  name: string,
  input: unknown,
  mcpIdentity?: { server: string; tool: string }
): NativeChatToolCallBlock {
  return { type: 'tool-call', name, input, state: 'completed', mcpIdentity }
}

describe('BrzA tool line titles', () => {
  it('gives Skill the sparkles icon and the skill name in its title', () => {
    expect(nativeChatToolIconName('Skill')).toBe('sparkles')
    const label = nativeChatToolLineLabel(call('Skill', { skill: 'brainstorming', args: 'x' }))
    expect(label).toMatchObject({ target: 'brainstorming', title: 'Skill · brainstorming' })
  })

  it('reads the skill name from a JSON string input', () => {
    const label = nativeChatToolLineLabel(call('Skill', '{"skill":"pdf"}'))
    expect(label.title).toBe('Skill · pdf')
  })

  it('names the Firebase project, with the flame icon and nothing to click', () => {
    const identity = { server: 'firebase', tool: 'firebase_get_project' }
    expect(nativeChatToolIconName('mcp__firebase__firebase_get_project', identity)).toBe('flame')
    const label = nativeChatToolLineLabel(
      call('mcp__firebase__firebase_get_project', { project_id: 'meu-app' }, identity)
    )
    expect(label).toMatchObject({ target: 'meu-app', title: 'Firebase · meu-app', filePath: null })
  })

  it('names the Context7 library from libraryName or libraryId', () => {
    const identity = { server: 'context7', tool: 'query-docs' }
    expect(nativeChatToolIconName('mcp__context7__query-docs', identity)).toBe('book-open')
    const byId = nativeChatToolLineLabel(
      call('mcp__context7__query-docs', { libraryId: '/vercel/next.js', query: 'x' }, identity)
    )
    expect(byId).toMatchObject({ target: 'vercel/next.js', title: 'Context7 · vercel/next.js' })
    const byName = nativeChatToolLineLabel(
      call('mcp__context7__resolve-library-id', { libraryName: 'react', query: 'x' }, identity)
    )
    expect(byName.title).toBe('Context7 · react')
  })

  it('falls back to the current title when the field is missing', () => {
    const identity = { server: 'context7', tool: 'query-docs' }
    const plain = nativeChatToolLineLabel(
      call('mcp__context7__query-docs', { query: 'hooks' }, identity)
    )
    expect(plain).toMatchObject({ target: 'hooks', title: 'hooks' })
    expect(nativeChatToolLineLabel(call('Skill', {})).title).not.toContain('Skill ·')
  })

  it('keeps the upstream verb, target and title for a command no BrzA category claims', () => {
    const command = 'echo done && wc -l notes.txt'
    expect(
      nativeChatToolLineLabel({ ...call('Bash', { command }), state: 'running' })
    ).toMatchObject({ verb: 'running', target: command, title: command, command: true })
    expect(
      nativeChatToolLineLabel(call('Bash', { command }), { type: 'tool-result', output: '3' })
    ).toMatchObject({ verb: 'ran', target: command, title: command, command: true })
    const long = `printf '%s\\n' ${'segment '.repeat(30)}| sort | uniq -c`
    const label = nativeChatToolLineLabel(call('Bash', { command: long }))
    expect(label).toMatchObject({ verb: 'ran', target: summarizeToolInput(long), title: long })
    expect(label.target).toMatch(/…$/)
  })
})
