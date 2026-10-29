import { useMemo, useState, type ComponentPropsWithoutRef } from 'react'
import type { ExtraProps } from 'react-markdown'
import type { CommentMarkdownExtension } from '@/components/sidebar/CommentMarkdown'
import { cn } from '@/lib/utils'
import { NativeChatMarkdownImage } from '../NativeChatMarkdownImage'
import { BRZA_IMAGE_MENTION_PROPERTY, remarkBrzaImageMentions } from './brza-image-mention-markdown'

type DivProps = ComponentPropsWithoutRef<'div'> & ExtraProps

/** Stays laid out but unseen until the image loads, so the nearby-load observer still fires and a failure shows nothing. */
function BrzaImageMention({ src }: { src: string }): React.JSX.Element {
  const [loaded, setLoaded] = useState(false)
  return (
    <div
      aria-hidden={loaded ? undefined : true}
      inert={!loaded}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(false)}
      className={cn(
        '[&>button]:my-1 [&_img]:h-24 [&_img]:max-h-24 [&_img]:w-auto',
        !loaded && 'invisible h-0'
      )}
    >
      <NativeChatMarkdownImage src={src} />
    </div>
  )
}

function mountImageMentions(extension: CommentMarkdownExtension): CommentMarkdownExtension {
  const Div = extension.components.div
  return {
    ...extension,
    sanitizeAttributes: {
      ...extension.sanitizeAttributes,
      div: [...(extension.sanitizeAttributes.div ?? []), BRZA_IMAGE_MENTION_PROPERTY]
    },
    components: {
      ...extension.components,
      div: (props: DivProps) => {
        const src =
          'data-brza-image-mention' in props ? props['data-brza-image-mention'] : undefined
        if (typeof src === 'string') {
          return <BrzaImageMention src={src} />
        }
        if (typeof Div === 'function') {
          return <Div {...props} />
        }
        const { node: _node, ...rest } = props
        return <div {...rest} />
      }
    }
  }
}

/** The document chat's extension, with thumbnails for image links once the reply settles (PLN-001/D44). */
export function useBrzaImageMentionExtension(
  extension: CommentMarkdownExtension | undefined,
  { settled, content }: { settled: boolean; content: string }
): CommentMarkdownExtension | undefined {
  const mounted = useMemo(() => extension && mountImageMentions(extension), [extension])
  return useMemo(() => {
    if (!mounted || !settled) {
      return mounted
    }
    return {
      ...mounted,
      remarkPlugins: [...mounted.remarkPlugins, remarkBrzaImageMentions(content)]
    }
  }, [content, mounted, settled])
}
