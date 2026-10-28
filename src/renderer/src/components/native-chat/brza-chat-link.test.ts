import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const linkCss = readFileSync(
  resolve('src/renderer/src/components/native-chat/brza-chat-link.css'),
  'utf8'
)

// jsdom does not resolve stylesheet colors, so the rule itself is asserted.
describe('brza chat link css', () => {
  it('lets inline code inside a link take the link color', () => {
    expect(linkCss).toMatch(/\.native-chat-markdown a code\s*\{[^}]*color:\s*inherit;/)
  })
})
