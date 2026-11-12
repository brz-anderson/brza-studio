import { Loader2 } from 'lucide-react'
import { useMemo, type RefObject } from 'react'
import {
  extractFrontMatter,
  markdownFrontMatterInner
} from '../../markdown/source-scanning/markdown-frontmatter'
import { VirtualMarkdownPreviewBody } from '../viewport/VirtualMarkdownPreviewBody'
import type { VirtualMarkdownPreviewNavigation } from '../viewport/use-markdown-preview-navigation'
import type { useMarkdownPreviewDocument } from '../document-worker/use-markdown-preview-document'
import type { useMarkdownPreviewDocumentSearch } from '../search/use-markdown-preview-document-search'
import type { Components } from 'react-markdown'
import { useTranslate } from '@/i18n/use-translate'
import { MarkdownTableOfContentsPanel } from '../../markdown/navigation/MarkdownTableOfContentsPanel'
import { MarkdownPreviewBody } from '../render-tree/MarkdownPreviewBody'
import { MarkdownFrontMatterBlock } from '../../MarkdownFrontMatterBlock'
import { MarkdownPreviewReviewToolbar } from '../review/MarkdownPreviewReviewToolbar'
import { MarkdownPreviewSearchBar } from '../search/MarkdownPreviewSearchBar'
import { NATIVE_CHAT_THEME_SURFACE_CLASS } from '@/lib/native-chat-theme-surface-style'
import type { MarkdownPreviewFoundation } from './use-markdown-preview-foundation'
import type { MarkdownPreviewReviewActions } from '../review/use-markdown-preview-review-actions'
import type { MarkdownPreviewViewport } from '../viewport/use-markdown-preview-viewport'

export function MarkdownPreviewSurface({
  largePreview,
  documentState,
  documentSearch,
  largeNavigationRef,
  scrollCacheKey,
  foundation,
  viewport,
  reviewActions,
  components,
  filePath,
  showTableOfContents,
  onCloseTableOfContents
}: {
  largePreview: boolean
  documentState: ReturnType<typeof useMarkdownPreviewDocument>
  documentSearch: ReturnType<typeof useMarkdownPreviewDocumentSearch>
  largeNavigationRef: RefObject<VirtualMarkdownPreviewNavigation | null>
  scrollCacheKey: string
  foundation: MarkdownPreviewFoundation
  viewport: MarkdownPreviewViewport
  reviewActions: MarkdownPreviewReviewActions
  components: Components
  filePath: string
  showTableOfContents: boolean
  onCloseTableOfContents?: () => void
}): React.JSX.Element {
  const t = useTranslate()
  const {
    isSearchOpen,
    canShowReviewTools,
    tableOfContentsItems,
    editorFontSize,
    isDark,
    markdownTheme,
    bodyRef,
    frontmatterVisible,
    renderedContent
  } = foundation

  const displayedContent =
    documentState.status === 'ready' ? documentState.content : renderedContent
  const frontMatter = useMemo(() => extractFrontMatter(displayedContent), [displayedContent])
  const frontMatterInner = useMemo(() => markdownFrontMatterInner(frontMatter), [frontMatter])

  return (
    <div
      className={`markdown-preview-shell ${NATIVE_CHAT_THEME_SURFACE_CLASS}`}
      style={markdownTheme.style}
    >
      {showTableOfContents ? (
        <MarkdownTableOfContentsPanel
          virtualized={largePreview}
          items={
            largePreview
              ? documentState.status === 'ready'
                ? documentState.document.toc
                : []
              : tableOfContentsItems
          }
          onClose={onCloseTableOfContents ?? (() => {})}
          onNavigate={viewport.navigateToTableOfContentsItem}
        />
      ) : null}
      <div
        ref={viewport.setRootRef}
        tabIndex={0}
        style={{
          fontSize: `${editorFontSize}px`,
          overflowAnchor: largePreview ? 'none' : undefined
        }}
        className={`markdown-preview h-full min-h-0 overflow-auto scrollbar-editor ${isDark ? 'markdown-dark' : 'markdown-light'}`}
      >
        {isSearchOpen ? (
          <MarkdownPreviewSearchBar
            searchFailed={documentSearch.failed}
            searchPending={documentSearch.pending}
            searchTruncated={documentSearch.truncated}
            foundation={foundation}
            viewport={viewport}
          />
        ) : null}
        {canShowReviewTools ? (
          <div inert={documentState.refreshing || undefined}>
            <MarkdownPreviewReviewToolbar
              foundation={foundation}
              reviewActions={reviewActions}
              filePath={filePath}
            />
          </div>
        ) : null}
        {/* Why: OS page translation can replace react-owned text nodes and crash reconciliation. */}
        <div
          ref={bodyRef}
          className="markdown-body"
          translate="no"
          data-markdown-preview-incomplete={largePreview || undefined}
        >
          {frontMatter && frontmatterVisible ? (
            <MarkdownFrontMatterBlock inner={frontMatterInner} />
          ) : null}
          {largePreview ? (
            <>
              <p className="relative text-xs text-muted-foreground">
                {t(
                  'editor.markdownPreview.largeNotice',
                  'Large preview. Use source view to copy the complete document. PDF export is unavailable.'
                )}
                {documentState.refreshing ? (
                  <span
                    role={documentState.refreshError ? 'alert' : 'status'}
                    className="absolute inset-0 bg-background"
                  >
                    {documentState.refreshError
                      ? t(
                          'editor.markdownPreview.refreshFailed',
                          'Preview update failed. Showing the previous version; open source view for current content.'
                        )
                      : t('editor.markdownPreview.preparing', 'Preparing preview…')}
                  </span>
                ) : null}
              </p>
              {documentState.status === 'ready' ? (
                <VirtualMarkdownPreviewBody
                  inert={documentState.refreshing}
                  revision={documentState.revision}
                  document={documentState.document}
                  client={documentState.client}
                  components={components}
                  rootRef={foundation.rootRef}
                  bodyRef={bodyRef}
                  navigationRef={largeNavigationRef}
                  query={foundation.query}
                  matches={documentSearch.matches}
                  activeMatchIndex={foundation.activeMatchIndex}
                  searchInstance={foundation.searchInstanceRef.current}
                  scrollCacheKey={scrollCacheKey}
                  activeAnnotationBlockKey={foundation.activeAnnotationBlockKey}
                />
              ) : documentState.status === 'error' ? (
                <p role="alert" className="text-sm text-muted-foreground">
                  {t(
                    'editor.markdownPreview.processingFailed',
                    'This document cannot be rendered within the preview limits. Open source view to read the complete file.'
                  )}
                </p>
              ) : (
                <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {t('editor.markdownPreview.preparing', 'Preparing preview…')}
                </p>
              )}
            </>
          ) : (
            <MarkdownPreviewBody content={renderedContent} components={components} />
          )}
        </div>
      </div>
    </div>
  )
}
