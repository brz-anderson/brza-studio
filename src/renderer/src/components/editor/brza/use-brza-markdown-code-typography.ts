import { useMemo } from 'react'
import { useEditorTypography } from '@/lib/editor/appearance/use-editor-typography'
import { useMarkdownSurfaceTheme } from '../use-markdown-surface-theme'

/** The editor's typography; in the Markdown code mode the chat's code font replaces its font family. */
export function useBrzaMarkdownCodeTypography(
  markdown: boolean
): ReturnType<typeof useEditorTypography> {
  const base = useEditorTypography()
  const { codeFontFamily } = useMarkdownSurfaceTheme()
  return useMemo(
    () =>
      markdown && codeFontFamily
        ? { ...base, fontFamily: codeFontFamily, cssFontFamily: codeFontFamily }
        : base,
    [base, markdown, codeFontFamily]
  )
}
