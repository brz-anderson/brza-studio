import './native-chat-appearance.css'
import './brza-chat-wide-blocks.css'
import { useMemo, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { resolveNativeChatAppearanceSettings } from '../../../../shared/native-chat-appearance-settings'
import { resolveNativeChatTheme } from '../../../../shared/native-chat-theme'
import { nativeChatThemeSurfaceStyle } from '@/lib/native-chat-theme-surface-style'
import { buildFontFamily } from '@/lib/monospace-font-family'
import { buildAppFontFamily } from '@/lib/app-font-family'
import { getSystemPrefersDark } from '@/lib/terminal-theme'
import { useSystemPrefersDark } from '../terminal-pane/use-system-prefers-dark'

export const NATIVE_CHAT_APPEARANCE_ROOT_CLASS = 'native-chat-appearance bg-chat-canvas'
// Bottom padding clears 20px control overhang; rail padding also covers its 34px overlay on macOS without scrollbar gutters.
export function nativeChatTranscriptOuterClass(railVisible: boolean): string {
  return railVisible ? 'px-9 pt-10 pb-10' : 'px-3 pt-10 pb-10 sm:px-4'
}
export const NATIVE_CHAT_TRANSCRIPT_COLUMN_CLASS =
  'mx-auto flex w-full max-w-(--chat-content-max-width) flex-col gap-5 px-[5px]'

export type NativeChatAppearanceStyle = CSSProperties &
  Record<`--${string}`, string | number> & {
    '--chat-font-size': string
    '--chat-ui-font-size': string
    '--chat-code-font-size': string
    '--chat-content-max-width': string
    '--chat-inline-code-ratio': string
    '--chat-estimated-line-height': number
    '--chat-estimated-chars-per-line': number
    '--chat-estimated-spacing-scale': number
  }

// Width buckets keep a pixel-by-pixel resize from re-deriving the entire transcript.
export function nativeChatColumnWidthBucket(width: number | null | undefined): number | null {
  return typeof width === 'number' && Number.isFinite(width) && width > 0
    ? Math.max(1, Math.floor(width / 32) * 32)
    : null
}

export function selectNativeChatAppearanceSettings(
  settings: Partial<GlobalSettings> | null | undefined
) {
  return {
    theme: settings?.theme,
    terminalCustomThemes: settings?.terminalCustomThemes,
    terminalFontFamily: settings?.terminalFontFamily,
    nativeChatAppearance: settings?.nativeChatAppearance
  }
}

export function nativeChatAppearanceStyle(
  settings: Partial<GlobalSettings> | null | undefined,
  measuredColumnWidthPx?: number | null,
  systemPrefersDark = getSystemPrefersDark()
): NativeChatAppearanceStyle {
  const appearance = resolveNativeChatAppearanceSettings(settings?.nativeChatAppearance)
  const { width, fontSize, codeFontSize } = appearance
  const uiFontSize = fontSize
  const maxWidthPx = width === 'wide' ? 960 : width === 'full' ? Number.POSITIVE_INFINITY : 736
  const measuredWidth = nativeChatColumnWidthBucket(measuredColumnWidthPx)
  const columnWidthPx = Math.min(
    measuredWidth ? measuredWidth : width === 'wide' ? 960 : 736,
    maxWidthPx
  )
  const font = buildFontFamily(settings?.terminalFontFamily ?? '')
  const style: NativeChatAppearanceStyle = {
    '--chat-font-size': `${fontSize}px`,
    '--chat-ui-font-size': `${uiFontSize}px`,
    '--chat-code-font-size': `${codeFontSize}px`,
    '--chat-content-max-width': width === 'full' ? 'none' : width === 'wide' ? '60rem' : '46rem',
    '--chat-width': width,
    '--chat-inline-code-ratio': `${codeFontSize / fontSize}em`,
    '--chat-estimated-line-height': (22 * fontSize) / 14,
    '--chat-estimated-chars-per-line': Math.max(
      1,
      Math.floor((((96 * columnWidthPx) / 736) * 14) / fontSize)
    ),
    '--chat-estimated-spacing-scale': uiFontSize / 14,
    '--chat-code-font-family': font,
    ...(appearance.fontFamily
      ? { '--chat-font-family': buildAppFontFamily(appearance.fontFamily) }
      : {})
  }
  Object.assign(
    style,
    nativeChatThemeSurfaceStyle(resolveNativeChatTheme(settings ?? {}, systemPrefersDark))
  )
  return style
}

export function useNativeChatAppearanceStyle(
  settings: Partial<GlobalSettings> | null | undefined,
  measuredColumnWidthPx?: number | null
): NativeChatAppearanceStyle {
  const selectInputs = useShallow(selectNativeChatAppearanceSettings)
  const inputs = selectInputs(settings)
  const systemPrefersDark = useSystemPrefersDark()
  const measuredWidth = nativeChatColumnWidthBucket(measuredColumnWidthPx)
  return useMemo(
    () => nativeChatAppearanceStyle(inputs, measuredWidth, systemPrefersDark),
    [inputs, measuredWidth, systemPrefersDark]
  )
}
