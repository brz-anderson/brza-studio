import './native-chat-appearance.css'
import '../brza-chat-code-columns.css'
import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  DEFAULT_NATIVE_CHAT_FONT_SIZE,
  resolveNativeChatAppearanceSettings
} from '../../../../../shared/native-chat/settings/native-chat-appearance-settings'
import { DEFAULT_APP_FONT_FAMILY } from '../../../../../shared/app-lifecycle/appearance/app-font-family'
import { resolveNativeChatTheme } from '../../../../../shared/native-chat-theme'
import { nativeChatThemeSurfaceStyle } from '@/lib/native-chat-theme-surface-style'
import { buildAppFontFamily } from '@/app-shell/appearance/app-font-family'
import { resolveEditorFontStack } from '../../../../../shared/editor/editor-typography'
import { getSystemPrefersDark } from '@/lib/terminal/appearance/terminal-theme'
import { useSystemPrefersDark } from '../../../hooks/theme/use-system-prefers-dark'
import type { GlobalSettings } from '../../../../../shared/settings/global-settings-types'

export const NATIVE_CHAT_APPEARANCE_ROOT_CLASS = 'native-chat-appearance bg-chat-canvas'
// One fixed bottom gap: the last row never hangs its controls; rail padding covers its 34px macOS overlay.
/** A subagent sheet's header already tops its transcript, so it pads like the sheet's body. */
export function nativeChatTranscriptOuterClass(railVisible: boolean, inSheet = false): string {
  if (inSheet) {
    return 'px-4 py-3'
  }
  return `native-chat-transcript-inset pt-10 pb-5 ${railVisible ? 'px-9' : 'px-3 sm:px-4'}`
}
export const NATIVE_CHAT_TRANSCRIPT_COLUMN_CLASS =
  'mx-auto flex w-full max-w-(--chat-content-max-width) flex-col gap-5 px-[5px]'

export type NativeChatAppearanceStyle = CSSProperties &
  Record<`--${string}`, string | number> & {
    '--chat-font-size': string
    '--chat-ui-font-size': string
    '--chat-line-height': string
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

/** The chat's own default face; a chosen chat or IDE font replaces it. */
const NATIVE_CHAT_SYSTEM_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif'

/** 20px at the default 13px, rounded so lines land on whole pixels at every size. */
function nativeChatLineHeightPx(fontSize: number): number {
  return Math.round((fontSize * 20) / 13)
}

/** Labels, icons and spacing keep their 14px size at the 13px default; elsewhere they match Text size. */
function nativeChatUiFontSize(fontSize: number): number {
  return fontSize === DEFAULT_NATIVE_CHAT_FONT_SIZE ? 14 : Math.max(12, Math.min(20, fontSize))
}

export function usesNativeChatSystemFont(
  settings: Partial<GlobalSettings> | null | undefined
): boolean {
  const appFont = settings?.appFontFamily?.trim() ?? ''
  return !appFont || appFont.toLowerCase() === DEFAULT_APP_FONT_FAMILY.toLowerCase()
}

export function selectNativeChatAppearanceSettings(
  settings: Partial<GlobalSettings> | null | undefined
) {
  return {
    theme: settings?.theme,
    terminalCustomThemes: settings?.terminalCustomThemes,
    terminalPluginPalettes: settings?.terminalPluginPalettes,
    pluginSystemEnabled: settings?.pluginSystemEnabled,
    disabledPlugins: settings?.disabledPlugins,
    appFontFamily: settings?.appFontFamily,
    editorFontFamily: settings?.editorFontFamily,
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
  const uiFontSize = nativeChatUiFontSize(fontSize)
  const maxWidthPx = width === 'wide' ? 960 : width === 'full' ? Number.POSITIVE_INFINITY : 736
  const measuredWidth = nativeChatColumnWidthBucket(measuredColumnWidthPx)
  const columnWidthPx = Math.min(
    measuredWidth ? measuredWidth : width === 'wide' ? 960 : 736,
    maxWidthPx
  )
  const codeFont = resolveEditorFontStack(settings)
  const style: NativeChatAppearanceStyle = {
    '--chat-font-size': `${fontSize}px`,
    '--chat-ui-font-size': `${uiFontSize}px`,
    '--chat-line-height': `${nativeChatLineHeightPx(fontSize)}px`,
    '--chat-code-font-size': `${codeFontSize}px`,
    '--chat-content-max-width': width === 'full' ? 'none' : width === 'wide' ? '60rem' : '46rem',
    '--chat-inline-code-ratio': `${codeFontSize / fontSize}em`,
    '--chat-estimated-line-height': (22 * fontSize) / DEFAULT_NATIVE_CHAT_FONT_SIZE,
    '--chat-estimated-chars-per-line': Math.max(
      1,
      Math.floor((((96 * columnWidthPx) / 736) * 14) / fontSize)
    ),
    '--chat-estimated-spacing-scale': uiFontSize / 14,
    '--chat-code-font-family': codeFont,
    ...(appearance.fontFamily
      ? { '--chat-font-family': buildAppFontFamily(appearance.fontFamily) }
      : usesNativeChatSystemFont(settings)
        ? { '--chat-font-family': NATIVE_CHAT_SYSTEM_FONT_FAMILY }
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
