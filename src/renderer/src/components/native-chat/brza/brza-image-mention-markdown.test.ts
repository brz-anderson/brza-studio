import type { Root, RootContent } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { describe, expect, it } from 'vitest'
import { remarkNativeChatFileLinks } from '@/components/sidebar/comment-markdown-native-chat-file-links'
import { routeNativeChatHref } from '../../../../../shared/native-chat-href-routing'
import { BRZA_IMAGE_MENTION_PROPERTY, remarkBrzaImageMentions } from './brza-image-mention-markdown'

const existing = new Set(['/abs/shot.png'])

function transform(markdown: string, mentions = remarkBrzaImageMentions(markdown)): Root {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkNativeChatFileLinks((link) => existing.has(link.pathText)))
    .use(mentions)
  const tree = processor.parse(markdown)
  processor.runSync(tree, markdown)
  return tree
}

// The file link plugin rewrites file hrefs; compare what they point at.
function mentions(nodes: readonly RootContent[]): string[] {
  return nodes.flatMap((node) => {
    const src = node.data?.hProperties?.[BRZA_IMAGE_MENTION_PROPERTY]
    if (typeof src === 'string') {
      const route = routeNativeChatHref(src)
      return [route.kind === 'file' ? route.pathText : route.kind === 'web' ? route.url : src]
    }
    return 'children' in node ? mentions(node.children) : []
  })
}

describe('remarkBrzaImageMentions', () => {
  it('puts a thumbnail after the paragraph of an existing inline-code path, a Markdown link and an image URL', () => {
    const tree = transform(
      'Saved `/abs/shot.png`.\n\nSee [print](shot.png) and https://cdn.example.com/a.png?v=2 here.'
    )

    expect(tree.children.map((node) => node.type)).toEqual([
      'paragraph',
      'paragraph',
      'paragraph',
      'paragraph',
      'paragraph'
    ])
    const [first, firstMention, second] = tree.children
    expect(first.type === 'paragraph' && first.children[1]?.type).toBe('link')
    expect(mentions([firstMention])).toEqual(['/abs/shot.png'])
    expect(second.type === 'paragraph' && second.children.map((child) => child.type)).toContain(
      'link'
    )
    expect(mentions(tree.children).slice(1)).toEqual([
      'shot.png',
      'https://cdn.example.com/a.png?v=2'
    ])
  })

  it('shows one thumbnail per image, and none when the image is already shown inline', () => {
    expect(mentions(transform('[a](shot.png)\n\n[b](shot.png)').children)).toEqual(['shot.png'])
    expect(mentions(transform('![a](shot.png)\n\n[b](shot.png)').children)).toEqual([])
  })

  it('claims each image across the separately parsed blocks of one message', () => {
    const firstBlock = 'Here is [the print](shot.png).'
    const secondBlock = 'Again [it](shot.png).'
    const plugin = remarkBrzaImageMentions(`${firstBlock}\n\n${secondBlock}`)

    expect(mentions(transform(firstBlock, plugin).children)).toEqual(['shot.png'])
    expect(mentions(transform(secondBlock, plugin).children)).toEqual([])
    expect(mentions(transform(firstBlock, plugin).children)).toEqual(['shot.png'])
  })

  it('leaves missing paths, non-image links, list items and fenced code alone', () => {
    expect(mentions(transform('Gone `/abs/missing.png`.').children)).toEqual([])
    expect(
      mentions(transform('[readme](README.md) and https://example.com/page').children)
    ).toEqual([])
    expect(mentions(transform('```\n/abs/shot.png\n[x](shot.png)\n```').children)).toEqual([])
    const list = transform('- [print](shot.png)').children[0]
    expect(list?.type === 'list' && list.children[0]?.children.map((node) => node.type)).toEqual([
      'paragraph',
      'paragraph'
    ])
  })
})
