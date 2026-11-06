/** The view a newly opened Markdown file starts in; per-tab toggles still override it. */
export type MarkdownDefaultViewMode = 'source' | 'rich' | 'preview'

// BrzA opens Markdown in the read-only preview first; upstream defaults to Rich.
export const DEFAULT_MARKDOWN_DEFAULT_VIEW_MODE: MarkdownDefaultViewMode = 'preview'

/** Profiles saved before the setting existed (or with a malformed value) open in the read-only preview. */
export function normalizeMarkdownDefaultViewMode(value: unknown): MarkdownDefaultViewMode {
  return value === 'source' || value === 'rich' || value === 'preview'
    ? value
    : DEFAULT_MARKDOWN_DEFAULT_VIEW_MODE
}
