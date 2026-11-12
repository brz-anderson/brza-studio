import { useTranslate } from '@/i18n/use-translate'

/** The preview's "Front Matter" box; `remarkFrontmatter` drops the block from the body. */
export function MarkdownFrontMatterBlock({ inner }: { inner: string }): React.JSX.Element {
  const t = useTranslate()
  return (
    <div className="mb-4 rounded border border-border/60 bg-muted/40 px-3 py-2">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {t('auto.components.editor.MarkdownPreview.2b2b31382c', 'Front Matter')}
      </div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground font-mono scrollbar-editor">
        {inner}
      </pre>
    </div>
  )
}
