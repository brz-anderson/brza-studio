import type * as Monaco from 'monaco-editor'
import { ISLANDS_DARK_MONACO_THEME, ISLANDS_DARK_THEME_NAME } from '../../islands-dark-theme'

/**
 * O editor escuro do BrzA usa `islands-dark`, que não herda do `vs-dark`; sem isto, as regras
 * escuras de Markdown que o upstream põe no `vs-dark` não chegam ao editor.
 */
export function defineIslandsDarkMarkdownTheme(
  monaco: Pick<typeof Monaco.editor, 'defineTheme'>,
  darkRules: readonly Monaco.editor.ITokenThemeRule[]
): void {
  monaco.defineTheme(ISLANDS_DARK_THEME_NAME, {
    ...ISLANDS_DARK_MONACO_THEME,
    rules: [...ISLANDS_DARK_MONACO_THEME.rules, ...darkRules]
  })
}
