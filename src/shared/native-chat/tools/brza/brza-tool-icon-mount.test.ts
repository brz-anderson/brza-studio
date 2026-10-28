import { describe, expect, it, vi } from 'vitest'
import { nativeChatToolIconName, nativeChatToolRunIconName } from '../native-chat-tool-icon'
import type * as BrzaToolCategories from './brza-tool-categories'

// Guards the upstream mount lines: a BrzA category reaches the shared icon resolvers.
vi.mock('./brza-tool-categories', async (importOriginal) => {
  const original = await importOriginal<typeof BrzaToolCategories>()
  const resolver = original.createBrzaToolCategoryResolver([
    { category: 'skill', iconName: 'sparkles', rowWords: ['skill'] },
    { category: 'git', iconName: 'git-logo', matchesCommand: (command) => /^git\s/.test(command) }
  ])
  return {
    ...original,
    brzaToolIconName: resolver.iconName,
    brzaToolRunIconName: resolver.runIconName
  }
})

describe('BrzA categories mounted on the shared tool icons', () => {
  it('draws the BrzA icon for a registered row word and command', () => {
    expect(nativeChatToolIconName('Skill')).toBe('sparkles')
    expect(nativeChatToolIconName('Bash', undefined, { command: 'git status' })).toBe('git-logo')
  })

  it('keeps the upstream glyph for everything the module does not register', () => {
    expect(nativeChatToolIconName('Read')).toBe('eye')
    expect(nativeChatToolIconName('Bash', undefined, { command: 'ls' })).toBe('square-terminal')
  })

  it('falls back to the upstream run glyph when BrzA categories are mixed', () => {
    expect(nativeChatToolRunIconName([{ name: 'Skill' }])).toBe('sparkles')
    const commands = [
      { name: 'Bash', input: { command: 'git status' } },
      { name: 'Bash', input: { command: 'ls' } }
    ]
    expect(nativeChatToolRunIconName(commands)).toBe('square-terminal')
  })
})
