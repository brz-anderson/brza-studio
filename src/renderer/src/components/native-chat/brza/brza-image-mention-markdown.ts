import type { Nodes, Paragraph, Parent, RootContent } from 'mdast'
import { IMAGE_FILE_EXTENSIONS } from '../../../../../shared/image-file-extensions'
import { routeNativeChatHref } from '../../../../../shared/native-chat-href-routing'

/** Hast property of the thumbnail placeholder, carried through sanitize to the `div` renderer. */
export const BRZA_IMAGE_MENTION_PROPERTY = 'dataBrzaImageMention'

const FLOW_PARENTS = new Set(['root', 'blockquote', 'list', 'listItem', 'footnoteDefinition'])

function hasImageExtension(path: string): boolean {
  const lower = path.toLowerCase()
  return IMAGE_FILE_EXTENSIONS.some((extension) => lower.endsWith(extension))
}

function imageKey(url: string): string | null {
  const route = routeNativeChatHref(url)
  if (route.kind === 'file') {
    return hasImageExtension(route.pathText) ? `file:${route.pathText}` : null
  }
  if (route.kind === 'web' && /^https?:/i.test(route.url)) {
    try {
      return hasImageExtension(new URL(route.url).pathname) ? `web:${route.url}` : null
    } catch {
      return null
    }
  }
  return null
}

function mentionNode(src: string): Paragraph {
  return {
    type: 'paragraph',
    children: [],
    data: { hName: 'div', hProperties: { [BRZA_IMAGE_MENTION_PROPERTY]: src } }
  }
}

type Claim = (key: string) => boolean

function collectMentions(node: Nodes, claim: Claim, found: Paragraph[]): void {
  if (node.type === 'image' || node.type === 'link') {
    const key = imageKey(node.url)
    if (key && claim(key) && node.type === 'link') {
      found.push(mentionNode(node.url))
    }
  }
  if ('children' in node) {
    for (const child of node.children) {
      collectMentions(child, claim, found)
    }
  }
}

function placeMentions(parent: Parent, claim: Claim): void {
  const children: RootContent[] = []
  for (const child of parent.children) {
    children.push(child)
    if (FLOW_PARENTS.has(child.type) && 'children' in child) {
      placeMentions(child, claim)
      continue
    }
    const found: Paragraph[] = []
    collectMentions(child, claim, found)
    children.push(...found)
  }
  parent.children = children
}

/** Image links in a settled reply get a thumbnail below their block, at the image's first mention in `message`. */
export function remarkBrzaImageMentions(
  message: string
): () => (tree: Parent, file: { value?: unknown }) => void {
  // Image → its first mention; shared by the blocks a streamed reply stays cut into, each parsed alone.
  const firstMentions = new Map<string, string>()
  return () => (tree, file) => {
    const block = String(file.value ?? '')
    const at = message.indexOf(block)
    const blockId = at !== -1 ? String(at) : block
    let order = 0
    placeMentions(tree, (key) => {
      const mention = `${blockId}:${order++}`
      const first = firstMentions.get(key)
      if (first === undefined) {
        firstMentions.set(key, mention)
        return true
      }
      return first === mention
    })
  }
}
