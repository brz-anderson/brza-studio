import type { CSSProperties } from 'react'
import type { NativeChatTheme } from '../../../shared/native-chat-theme'

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
    '--chat-composer-border-mix': light ? '11%' : '9%'
  }
}
