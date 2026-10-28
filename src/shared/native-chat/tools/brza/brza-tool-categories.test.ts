import { describe, expect, it } from 'vitest'
import { createBrzaToolCategoryResolver } from './brza-tool-categories'

const resolver = createBrzaToolCategoryResolver([
  { category: 'skill', iconName: 'sparkles', rowWords: ['skill'] },
  {
    category: 'figma',
    iconName: 'pen-tool',
    matchesMcpTool: ({ server }) => /figma/i.test(server)
  },
  { category: 'git', iconName: 'git-logo', matchesCommand: (command) => /^git\s/.test(command) }
])

describe('BrzA tool categories', () => {
  it('resolves a registered row word case-insensitively to its category and icon', () => {
    expect(resolver.category(' Skill ')).toBe('skill')
    expect(resolver.iconName('Skill')).toBe('sparkles')
  })

  it('resolves an MCP tool by its server, from the name prefix or explicit identity', () => {
    expect(resolver.category('mcp__plugin_figma_figma__get_screenshot')).toBe('figma')
    expect(resolver.iconName('get screenshot', { server: 'figma', tool: 'get_screenshot' })).toBe(
      'pen-tool'
    )
    expect(resolver.category('mcp__context7__query_docs')).toBeNull()
  })

  it('resolves a shell command only from a command tool input', () => {
    expect(resolver.category('Bash', undefined, { command: 'git commit -m "x"' })).toBe('git')
    expect(resolver.category('Bash', undefined, { command: 'ls' })).toBeNull()
    expect(resolver.category('Read', undefined, { command: 'git status' })).toBeNull()
  })

  it('leaves unregistered words to the upstream vocabulary', () => {
    expect(resolver.category('Read')).toBeNull()
    expect(resolver.iconName('Bash', undefined, { command: 'pnpm test' })).toBeNull()
  })

  it('gives a run its icon only when every call shares one BrzA category', () => {
    expect(resolver.runIconName([{ name: 'Skill' }, { name: 'skill' }])).toBe('sparkles')
    expect(resolver.runIconName([{ name: 'Skill' }, { name: 'Read' }])).toBeNull()
    expect(resolver.runIconName([])).toBeNull()
  })
})
