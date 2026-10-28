import { normalizeToolInput } from '../native-chat-tool-summary'
import type { NativeChatToolCallBlock, NativeChatToolResultBlock } from '../../../native-chat-types'
import type { BrzaToolCategoryDefinition } from './brza-tool-categories'

export const BRZA_FIGMA_CATEGORY = {
  category: 'figma',
  iconName: 'pen-tool',
  matchesMcpTool: ({ server }) => /figma/i.test(server)
} as const satisfies BrzaToolCategoryDefinition

// Output past 16 KiB arrives cut at the head (D39), so only the first tags are read.
const MAX_SCANNED_TAGS = 200
const MAX_NAME_LENGTH = 80

const XML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'"
}

function decodeEntities(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, entity: string) => XML_ENTITIES[entity])
}

/** `1-2` and `1:2` name the same node. */
function normalizeNodeId(value: string): string {
  return value.trim().replace(/-/g, ':')
}

function tagAttribute(tag: string, names: string): string | null {
  const match = new RegExp(`\\s(?:${names})="([^"]*)"`).exec(tag)
  return match ? match[1] : null
}

/** Reads `<frame id="1:2" name="X">` (get_metadata) and `data-node-id`/`data-name` (get_design_context). */
function nodeNameFromOutput(output: string, nodeId: string | null): string | null {
  let first: string | null = null
  let scanned = 0
  for (const [tag] of output.matchAll(/<[A-Za-z][\w.-]*\s[^>]*>/g)) {
    if (scanned++ >= MAX_SCANNED_TAGS) {
      break
    }
    const name = tagAttribute(tag, 'data-name|name')?.trim()
    if (!name) {
      continue
    }
    const id = tagAttribute(tag, 'data-node-id|id')
    if (nodeId !== null && id !== null && normalizeNodeId(id) === nodeId) {
      return name
    }
    first ??= name
  }
  return nodeId === null ? first : null
}

function nodeIdFromInput(input: unknown): string | null {
  const record = normalizeToolInput(input)
  if (record === null || typeof record !== 'object' || !('nodeId' in record)) {
    return null
  }
  const value = record.nodeId
  return typeof value === 'string' && value.trim() ? normalizeNodeId(value) : null
}

/** "Figma · <node name>", else "Figma · <nodeId>"; null leaves the default line. */
export function brzaFigmaToolLineTitle(
  call: NativeChatToolCallBlock,
  result?: NativeChatToolResultBlock
): { target: string; title: string } | null {
  const nodeId = nodeIdFromInput(call.input)
  const name = result && !result.isError ? nodeNameFromOutput(result.output, nodeId) : null
  const target = (name === null ? nodeId : decodeEntities(name))?.replace(/\s+/g, ' ').trim()
  if (!target) {
    return null
  }
  const shown =
    target.length > MAX_NAME_LENGTH ? `${target.slice(0, MAX_NAME_LENGTH - 1)}…` : target
  return { target: shown, title: `Figma · ${shown}` }
}
