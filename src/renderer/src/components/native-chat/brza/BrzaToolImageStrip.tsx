import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type { NativeChatImageRefBlock } from '../../../../../shared/native-chat-types'
import { NativeChatMarkdownImage } from '../NativeChatMarkdownImage'

const CLOSED_LIMIT = 4

/** Tool-result images as ~96px thumbnails beside the closed line; the +N tile opens the line to all of them. */
export function BrzaToolImageStrip({
  images,
  expanded,
  onExpand
}: {
  images: NativeChatImageRefBlock[] | undefined
  expanded: boolean
  onExpand: () => void
}): React.JSX.Element | null {
  // The same image twice in one result is one temp file; show it once.
  const bySource = new Map<string, NativeChatImageRefBlock>()
  for (const image of images ?? []) {
    const source = image.url ?? image.path
    if (source && !bySource.has(source)) {
      bySource.set(source, image)
    }
  }
  const sources = [...bySource.entries()]
  if (sources.length === 0) {
    return null
  }
  const capped = !expanded && sources.length > CLOSED_LIMIT
  const shown = capped ? sources.slice(0, CLOSED_LIMIT) : sources
  return (
    <div
      className={cn(
        'ml-6 flex flex-wrap items-start gap-1.5 py-1',
        '[&>button]:my-0 [&>button]:shrink-0 [&_img]:h-24 [&_img]:max-h-24 [&_img]:w-auto'
      )}
    >
      {shown.map(([source, image]) => (
        <NativeChatMarkdownImage key={source} src={source} alt={image.alt} />
      ))}
      {capped ? (
        <button
          type="button"
          onClick={onExpand}
          aria-label={translate('brza.native-chat.showAllImages', 'Show all {{total}} images', {
            total: sources.length
          })}
          className="flex size-24 shrink-0 items-center justify-center rounded-md border border-border bg-chat-canvas text-sm text-chat-foreground-faint transition-colors hover:border-ring hover:text-chat-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          +{sources.length - CLOSED_LIMIT}
        </button>
      ) : null}
    </div>
  )
}
