import { useContext, useMemo, useRef } from 'react'
import type { Components } from 'react-markdown'
import { openOwnedHttpLink } from '@/lib/browser/navigation/http-link-routing'
import { useAppStore } from '@/store'
import { NATIVE_CHAT_THEME_SURFACE_CLASS } from '@/lib/native-chat-theme-surface-style'
import { MarkdownPreviewBody } from '@/components/editor/markdown-preview/render-tree/MarkdownPreviewBody'
import { MarkdownFrontMatterBlock } from '@/components/editor/MarkdownFrontMatterBlock'
import {
  extractFrontMatter,
  markdownFrontMatterInner
} from '@/components/editor/markdown/source-scanning/markdown-frontmatter'
import { isMarkdownPreviewSystemBrowserModifier } from '@/components/editor/markdown/link-routing/markdown-preview-links'
import { useMarkdownSurfaceTheme } from '@/components/editor/use-markdown-surface-theme'
import { NativeChatMarkdownImageOwnerContext } from '../media/images/native-chat-markdown-image-owner'
import { resolveNativeChatHttpLinkSourceOwner } from '../links/actions/native-chat-http-link-source-owner'

const isMac = navigator.userAgent.includes('Mac')

function absoluteHttpUrl(value: string | undefined): string | null {
  return value && /^https?:\/\//i.test(value.trim()) ? value.trim() : null
}

/** The editor's eye for a chat fence: no file behind it, so relative links and images stay inert (PLN-001 D54). */
export function BrzaMarkdownExpandPreview({ content }: { content: string }): React.JSX.Element {
  const theme = useMarkdownSurfaceTheme()
  // The chat's own workspace owns the link, so the owner is resolved from it and not from the Active Server.
  const worktreeId = useContext(NativeChatMarkdownImageOwnerContext)?.fileLinkContext?.worktreeId
  const bodyRef = useRef<HTMLDivElement>(null)
  const frontMatterInner = useMemo(
    () => markdownFrontMatterInner(extractFrontMatter(content)),
    [content]
  )

  const components = useMemo<Components>(
    () => ({
      a: ({ node: _node, href, children, ...props }) => (
        <a
          {...props}
          href={href}
          onClick={(event) => {
            event.preventDefault()
            const url = absoluteHttpUrl(href)
            if (url) {
              openOwnedHttpLink(url, {
                sourceOwner: worktreeId
                  ? resolveNativeChatHttpLinkSourceOwner(useAppStore.getState(), worktreeId)
                  : { kind: 'unknown' },
                ...(isMarkdownPreviewSystemBrowserModifier(event, isMac)
                  ? { modifierHeld: true }
                  : {})
              })
            } else if (href?.startsWith('#')) {
              const id = decodeURIComponent(href.slice(1))
              const body = bodyRef.current
              const target =
                body?.querySelector(`[id="${CSS.escape(id)}"]`) ??
                body?.querySelector(`[id="user-content-${CSS.escape(id)}"]`)
              target?.scrollIntoView({ block: 'start' })
            }
          }}
        >
          {children}
        </a>
      ),
      img: ({ node: _node, src, alt, ...props }) => {
        const url = typeof src === 'string' && /^(?:https?:|data:image\/)/i.test(src) ? src : null
        return url ? (
          <img {...props} src={url} alt={alt ?? ''} />
        ) : (
          <span title={typeof src === 'string' ? src : undefined} className="text-muted-foreground">
            {alt || (typeof src === 'string' ? src : '')}
          </span>
        )
      }
    }),
    [worktreeId]
  )

  return (
    <div
      className={`markdown-preview-shell ${NATIVE_CHAT_THEME_SURFACE_CLASS}`}
      style={theme.style}
    >
      <div
        style={{ fontSize: `${theme.fontSize}px` }}
        className={`markdown-preview h-full min-h-0 overflow-auto scrollbar-editor ${theme.isDark ? 'markdown-dark' : 'markdown-light'}`}
      >
        {/* Why: OS page translation can replace react-owned text nodes and crash reconciliation. */}
        <div ref={bodyRef} className="markdown-body" translate="no">
          {frontMatterInner ? <MarkdownFrontMatterBlock inner={frontMatterInner} /> : null}
          <MarkdownPreviewBody content={content} components={components} />
        </div>
      </div>
    </div>
  )
}
