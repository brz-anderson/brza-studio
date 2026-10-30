import './native-chat-appearance.css'
import './brza-chat-wide-blocks.css'
import { useMemo, type CSSProperties } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { resolveNativeChatAppearanceSettings } from '../../../../shared/native-chat-appearance-settings'
import { resolveNativeChatTheme } from '../../../../shared/native-chat-theme'
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
  const chatTheme = resolveNativeChatTheme(settings ?? {}, systemPrefersDark)
  const light = chatTheme.scheme === 'light'
  // The BrzA default leaves the app tokens in place; a catalog theme repaints the chat from its colors.
  if (!chatTheme.followsAppScheme) {
    style.colorScheme = light ? 'light' : 'dark'
    // Ghost controls inherit a color, so remapping the token alone leaves the app's color in place.
    style.color = 'var(--foreground)'
    Object.assign(style, {
      '--background': 'var(--chat-canvas)',
      '--foreground': 'var(--chat-foreground-strong)',
      '--muted-foreground': 'var(--chat-source-muted-foreground)',
      '--accent': 'color-mix(in srgb, var(--chat-source-foreground) 9%, var(--chat-canvas))',
      '--muted': 'color-mix(in srgb, var(--chat-source-foreground) 7%, var(--chat-canvas))',
      '--popover': 'color-mix(in srgb, var(--chat-source-foreground) 4%, var(--chat-canvas))',
      '--popover-foreground': 'var(--chat-foreground-strong)',
      '--accent-foreground': 'var(--chat-foreground-strong)',
      '--border': 'color-mix(in srgb, var(--chat-source-foreground) 7%, var(--chat-canvas))',
      '--input': 'color-mix(in srgb, var(--chat-source-foreground) 7%, var(--chat-canvas))',
      '--card': 'color-mix(in srgb, var(--chat-source-foreground) 4%, var(--chat-canvas))',
      '--card-foreground': 'var(--chat-foreground-strong)',
      '--primary': 'var(--chat-foreground-strong)',
      '--primary-foreground': 'var(--chat-canvas)',
      '--secondary': 'var(--muted)',
      '--secondary-foreground': 'var(--chat-foreground-strong)',
      '--ring': 'color-mix(in srgb, var(--chat-source-foreground) 44%, var(--chat-canvas))',
      '--chat-source-background': chatTheme.background,
      '--chat-source-foreground': chatTheme.foreground,
      '--chat-source-muted-foreground':
        'color-mix(in srgb, var(--chat-source-foreground) 62%, var(--chat-canvas))',
      '--chat-canvas-mix': `${chatTheme.canvasMix}%`,
      '--chat-faint-mix': light ? '100%' : '83%',
      '--chat-user-mix': light ? '4%' : '7%',
      '--chat-user-border-mix': light ? '7%' : '6%',
      '--chat-code-mix': light ? '2%' : '3.5%',
      '--chat-code-base': light ? 'var(--chat-canvas)' : 'transparent',
      '--chat-inline-code-mix': light ? '4%' : '6%',
      '--chat-inline-code-base': light ? 'var(--chat-canvas)' : 'transparent',
      '--chat-inline-code-border-mix': light ? '9%' : '8%',
      '--chat-composer-mix': light ? '0%' : '4%',
      '--chat-composer-base': light ? 'var(--chat-canvas)' : 'transparent',
      '--chat-composer-border-mix': light ? '11%' : '9%'
    })
  }
  style['--chat-foreground-mix'] = `${chatTheme.foregroundMix}%`
  style['--chat-strong-mix'] = `${chatTheme.strongMix}%`
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
