import type { CSSProperties } from 'react'
import type { NativeChatTheme } from '../../../shared/native-chat-theme'
import { BRZA_DARK_THEME_NAME } from '../../../shared/terminal-themes/defaults'
import { terminalChatSelectionMix } from './chat-selection-mix'

/** Re-evaluates the chat color mixes (main.css) where this style supplies their source colors. */
export const NATIVE_CHAT_THEME_SURFACE_CLASS = 'native-chat-theme-surface'

export type NativeChatThemeSurfaceStyle = CSSProperties & Record<`--${string}`, string>

/** The chat theme painted on a surface: the BrzA default leaves the app tokens in place, a catalog
 *  theme repaints them from its colors. */
export function nativeChatThemeSurfaceStyle(theme: NativeChatTheme): NativeChatThemeSurfaceStyle {
  const style: NativeChatThemeSurfaceStyle = {
    '--chat-foreground-mix': `${theme.foregroundMix}%`,
    '--chat-strong-mix': `${theme.strongMix}%`
  }
  if (theme.followsAppScheme) {
    return style
  }
  const light = theme.scheme === 'light'
  return {
    ...style,
    colorScheme: light ? 'light' : 'dark',
    // Ghost controls inherit a color, so remapping the token alone leaves the app's color in place.
    color: 'var(--foreground)',
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
    // The chat theme owns the surface, so a plugin theme's message bubble yields too.
    '--chat-user-message': 'initial',
    // The theme's own colors keep text and selection legible, so the plugin's yield too (#39432).
    '--chat-bold-foreground': 'initial',
    '--chat-muted-foreground': 'initial',
    '--chat-inline-code': 'initial',
    '--chat-inline-code-foreground': 'initial',
    '--chat-code-block': 'initial',
    '--chat-selection': 'initial',
    '--chat-selection-foreground': 'initial',
    // The plugin's link color yields too; the chat's own link mixes the default blue, never the zeroed value.
    '--text-link': 'initial',
    '--chat-link': `color-mix(in srgb, ${light ? '#0969da' : '#4493f8'} 70%, var(--chat-source-foreground))`,
    '--chat-selection-mix': `${terminalChatSelectionMix(
      { foreground: theme.foreground, background: theme.background },
      light ? 'light' : 'dark'
    )}%`,
    '--chat-source-background': theme.background,
    '--chat-source-foreground': theme.foreground,
    '--chat-source-muted-foreground':
      'color-mix(in srgb, var(--chat-source-foreground) 62%, var(--chat-canvas))',
    '--chat-canvas-mix': `${theme.canvasMix}%`,
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
    '--chat-composer-border-mix': light ? '11%' : '9%',
    // PLN-007: the BrzA Dark Theme keeps the focused composer's fill at rest, so focus changes only the border.
    ...(theme.themeName === BRZA_DARK_THEME_NAME
      ? {
          '--chat-composer-resting-fill':
            'linear-gradient(180deg, rgb(255 255 255 / 0.07) 0 1px, transparent 1px), var(--chat-composer-focus-fill)'
        }
      : {})
  }
}
