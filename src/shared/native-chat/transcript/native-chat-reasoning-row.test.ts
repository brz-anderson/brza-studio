import { describe, expect, it } from 'vitest'
import { nativeChatReasoningPreview } from './native-chat-reasoning-row'

describe('the reasoning preview on the closed line', () => {
  it('reads the reasoning as running text, without its markup and with line breaks as spaces', () => {
    expect(
      nativeChatReasoningPreview(
        '## Plan\n\nCheck **both** `snake_case` paths in [the docs](https://x.dev):\n\n- first\n> 2. quoted\n\n```ts\nconst a = 1\n```\n\n---\n*done*'
      )
    ).toBe('Plan Check both snake_case paths in the docs: first quoted const a = 1 done')
  })

  it('keeps underscores and asterisks that do not mark emphasis', () => {
    expect(nativeChatReasoningPreview('read my_file_name and 2 * 3')).toBe(
      'read my_file_name and 2 * 3'
    )
  })

  it('is empty for reasoning that is only markup', () => {
    expect(nativeChatReasoningPreview('```\n```\n---')).toBe('')
  })
})
