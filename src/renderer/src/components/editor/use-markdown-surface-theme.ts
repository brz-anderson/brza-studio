import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAppStore } from '@/store'
import { useSystemPrefersDark } from '@/hooks/theme/use-system-prefers-dark'
import { useMonacoDark } from '@/hooks/use-monaco-theme'
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
  const monacoDark = useMonacoDark()
  return useMemo(
    () => markdownSurfaceTheme(settings, systemPrefersDark, monacoDark),
    [settings, systemPrefersDark, monacoDark]
  )
}
