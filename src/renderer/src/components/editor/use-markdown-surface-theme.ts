import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { useSystemPrefersDark } from '@/components/terminal-pane/use-system-prefers-dark'
import {
  markdownSurfaceTheme,
  selectMarkdownSurfaceThemeSettings,
  type MarkdownSurfaceTheme
} from './markdown-surface-theme'

/** Replaces `useDocumentDarkTheme` inside the Markdown viewer, whose scheme may follow the chat. */
export function useMarkdownSurfaceTheme(): MarkdownSurfaceTheme {
  const settings = useAppStore(
    useShallow((state) => selectMarkdownSurfaceThemeSettings(state.settings))
  )
  const systemPrefersDark = useSystemPrefersDark()
  return useMemo(
    () => markdownSurfaceTheme(settings, systemPrefersDark),
    [settings, systemPrefersDark]
  )
}
