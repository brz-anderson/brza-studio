import { useEffect, useState } from 'react'
import { useDocumentDarkTheme } from '@/hooks/use-document-dark-theme'
import { monacoThemeName } from '@/lib/islands-dark-theme'
import { useCodeEditorThemeStore } from '@/store/code-editor-theme'

const definedThemes = new Set<string>()

/** The mode Monaco paints in: a separate editor theme's base, else the painted app mode.
 *  `isDarkOverride` passes an already resolved app mode. */
export function useMonacoDark(isDarkOverride?: boolean): boolean {
  const documentDark = useDocumentDarkTheme()
  const editorBase = useCodeEditorThemeStore((state) => state.override?.base)
  return editorBase ? editorBase === 'dark' : (isDarkOverride ?? documentDark)
}

/** The Monaco theme every editor surface uses: the editor or app theme's, else the built-in. */
export function useMonacoTheme(isDarkOverride?: boolean): string {
  const isDark = useMonacoDark(isDarkOverride)
  const pluginTheme = useCodeEditorThemeStore((state) => state.monaco)
  const [defined, setDefined] = useState(() => definedThemes)

  useEffect(() => {
    if (!pluginTheme || definedThemes.has(pluginTheme.name)) {
      return
    }
    let current = true
    // Why lazy: surfaces that never show an editor must not load Monaco for a theme.
    void import('monaco-editor').then((monaco) => {
      monaco.editor.defineTheme(pluginTheme.name, pluginTheme.data)
      definedThemes.add(pluginTheme.name)
      if (current) {
        setDefined(new Set(definedThemes))
      }
    })
    return () => {
      current = false
    }
  }, [pluginTheme])

  // Why the built-in until defined: Monaco silently ignores a theme name it doesn't know yet.
  return pluginTheme && defined.has(pluginTheme.name) ? pluginTheme.name : monacoThemeName(isDark)
}
