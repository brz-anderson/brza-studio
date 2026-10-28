import { describe, expect, it } from 'vitest'
import { createBrzaToolCategoryResolver } from './brza-tool-categories'

const resolver = createBrzaToolCategoryResolver([
  { category: 'skill', iconName: 'sparkles', rowWords: ['skill'] },
  {
    category: 'figma',
    iconName: 'pen-tool',
    matchesMcpTool: ({ server }) => /figma/i.test(server)
  },
  {
    category: 'tests',
    iconName: 'flask-conical',
    matchesCommand: ({ argv }) => argv[0] === 'vitest'
  },
  {
    category: 'git',
    iconName: 'git-logo',
    matchesCommand: ({ argv }) => argv[0] === 'git',
    segmentIconName: ({ argv }) => (argv[1] === 'commit' ? 'git-commit-horizontal' : null)
  }
])

function bash(command: string) {
  return { name: 'Bash', input: { command } }
}

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

  it('matches each segment outside quotes, and the heaviest category wins a compound', () => {
    expect(resolver.category('Bash', undefined, { command: 'cd app && git status' })).toBe('git')
    expect(resolver.category('Bash', undefined, { command: 'git add . && vitest run' })).toBe(
      'tests'
    )
    expect(resolver.category('Bash', undefined, { command: 'echo "x && git status"' })).toBeNull()
  })

  it('lets a matched segment refine the icon, and a browser command keep the upstream globe', () => {
    expect(resolver.iconName('Bash', undefined, { command: 'git status' })).toBe('git-logo')
    expect(resolver.iconName('Bash', undefined, { command: 'git add -A && git commit -m x' })).toBe(
      'git-commit-horizontal'
    )
    expect(
      resolver.iconName('Bash', undefined, { command: 'orca snapshot && git status' })
    ).toBeNull()
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

  it('draws the category icon for a mixed run and a refined one only when all calls share it', () => {
    expect(resolver.runIconName([bash('git status'), bash('git commit -m x')])).toBe('git-logo')
    expect(resolver.runIconName([bash('git commit -m a'), bash('git commit -m b')])).toBe(
      'git-commit-horizontal'
    )
    expect(resolver.runIconName([bash('git status'), bash('ls')])).toBeNull()
  })
})
