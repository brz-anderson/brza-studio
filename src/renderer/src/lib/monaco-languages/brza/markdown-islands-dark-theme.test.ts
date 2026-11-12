import type * as Monaco from 'monaco-editor'
import { expect, it, vi } from 'vitest'
import { ISLANDS_DARK_MONACO_THEME, ISLANDS_DARK_THEME_NAME } from '../../islands-dark-theme'
import { MARKDOWN_TOKEN_PREFIX } from '../../plugin-monaco-token-rules'
import { createMarkdownTokensProvider } from '../markdown-textmate-tokens'

// The wasm tokenizer needs a browser; only the theme definitions matter here.
vi.mock('../textmate-token-provider', () => ({
  loadEditorCore: async () => ({
    core: { loadLanguage: async () => undefined, getLanguage: () => ({}) }
  }),
  createTokensProvider: () => ({})
}))

it('gives the Islands Dark editor theme the dark Markdown rules the upstream puts on vs-dark', async () => {
  const defined = new Map<string, Monaco.editor.IStandaloneThemeData>()
  await createMarkdownTokensProvider({
    editor: {
      defineTheme: vi.fn((name: string, data: Monaco.editor.IStandaloneThemeData) => {
        defined.set(name, data)
      })
    },
    languages: { setTokensProvider: vi.fn() }
  })

  const islands = defined.get(ISLANDS_DARK_THEME_NAME)
  expect(islands?.colors).toEqual(ISLANDS_DARK_MONACO_THEME.colors)
  expect(islands?.rules.slice(0, ISLANDS_DARK_MONACO_THEME.rules.length)).toEqual(
    ISLANDS_DARK_MONACO_THEME.rules
  )
  expect(islands?.rules).toEqual(expect.arrayContaining(defined.get('vs-dark')?.rules ?? []))
  expect(islands?.rules.some((rule) => rule.token.startsWith(MARKDOWN_TOKEN_PREFIX))).toBe(true)
})
