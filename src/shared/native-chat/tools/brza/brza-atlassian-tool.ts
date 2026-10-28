/** Jira and Confluence calls of the Atlassian MCP server: icon, title and the chip that opens the page (D39). */
import type { NativeChatToolCallBlock, NativeChatToolResultBlock } from '../../../native-chat-types'
import { mcpToolIdentity, type NativeChatMcpIdentity } from '../native-chat-tool-identity'
import { normalizeToolInput } from '../native-chat-tool-summary'
import type { BrzaToolCategoryDefinition } from './brza-tool-categories'

type AtlassianProduct = 'jira' | 'confluence'

/** Where a chip click goes: `url` when the call or its output names the site, else `sitePath` on the app's Jira site. */
export type BrzaAtlassianChipTarget = {
  kind: 'atlassian'
  url: string | null
  sitePath: string | null
  /** What a click puts on the clipboard when no site is known. */
  copyText: string
}

export type BrzaAtlassianChip = { label: string; target: BrzaAtlassianChipTarget }

type AtlassianReference = { target: string; chip: BrzaAtlassianChip | null }

const ISSUE_KEY = /^[A-Z][A-Z0-9_]*-\d+$/i
const PAGE_ID = /^\w+$/
const SITE_HOST = /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i

function atlassianProduct(identity: NativeChatMcpIdentity): AtlassianProduct | null {
  if (!/atlassian/i.test(identity.server)) {
    return null
  }
  if (/confluence/i.test(identity.tool)) {
    return 'confluence'
  }
  return /jira/i.test(identity.tool) ? 'jira' : null
}

export const BRZA_JIRA_CATEGORY = {
  category: 'jira',
  iconName: 'jira-logo',
  matchesMcpTool: (identity) => atlassianProduct(identity) === 'jira'
} as const satisfies BrzaToolCategoryDefinition

export const BRZA_CONFLUENCE_CATEGORY = {
  category: 'confluence',
  iconName: 'file-text',
  matchesMcpTool: (identity) => atlassianProduct(identity) === 'confluence'
} as const satisfies BrzaToolCategoryDefinition

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown): string | null {
  const trimmed = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return trimmed || null
}

function httpUrl(value: string): URL | null {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

/** The site a cloudId names when it is a domain or a URL; an id or a bare prefix names none. */
function siteHostFromCloudId(cloudId: unknown): string | null {
  const value = text(cloudId)
  const host = value !== null && /^https?:\/\//i.test(value) ? httpUrl(value)?.hostname : value
  return host && SITE_HOST.test(host) ? host.toLowerCase() : null
}

/** The output's `data` object; a cut-off, unparsable or failed output has none. */
function outputNode(result: NativeChatToolResultBlock | undefined): Record<string, unknown> | null {
  if (!result || result.isError) {
    return null
  }
  const parsed = normalizeToolInput(result.output)
  if (!isRecord(parsed)) {
    return null
  }
  return isRecord(parsed.data) ? parsed.data : parsed
}

function jiraReference(
  input: Record<string, unknown>,
  node: Record<string, unknown> | null
): AtlassianReference | null {
  const inputKey = text(input.issueIdOrKey)
  const outputKey = text(node?.key)
  const key = [inputKey, outputKey].find((value) => value !== null && ISSUE_KEY.test(value))
  if (!key) {
    return null
  }
  const fields = isRecord(node?.fields) ? node.fields : null
  const summary = outputKey?.toLowerCase() === key.toLowerCase() ? text(fields?.summary) : null
  const host = siteHostFromCloudId(input.cloudId)
  const sitePath = `/browse/${encodeURIComponent(key)}`
  return {
    target: summary ? `${key} — ${summary}` : key,
    chip: {
      label: key,
      target: {
        kind: 'atlassian',
        url: host ? `https://${host}${sitePath}` : null,
        sitePath,
        copyText: key
      }
    }
  }
}

function confluenceReference(
  input: Record<string, unknown>,
  node: Record<string, unknown> | null
): AtlassianReference | null {
  const content = isRecord(node?.content) ? node.content : node
  const title = text(node?.title) ?? text(content?.title) ?? text(input.title)
  if (!title) {
    return null
  }
  const pageId = [text(input.pageId), text(content?.id)].find(
    (value) => value !== null && PAGE_ID.test(value)
  )
  const base = text(content?.baseUrl)
  const web = text(content?.webUrl)
  const outputUrl = base && web && httpUrl(base + web) ? base + web : null
  const host = siteHostFromCloudId(input.cloudId)
  const sitePath = pageId ? `/wiki/pages/viewpage.action?pageId=${pageId}` : null
  const chipUrl = outputUrl ?? (host && sitePath ? `https://${host}${sitePath}` : null)
  return {
    target: title,
    chip:
      chipUrl || sitePath
        ? {
            label: 'página',
            target: {
              kind: 'atlassian',
              url: chipUrl,
              sitePath: outputUrl ? null : sitePath,
              copyText: pageId ?? title
            }
          }
        : null
  }
}

function atlassianReference(
  call: NativeChatToolCallBlock,
  result: NativeChatToolResultBlock | undefined
): AtlassianReference | null {
  const identity = mcpToolIdentity(call.name, call.mcpIdentity)
  const product = identity ? atlassianProduct(identity) : null
  const input = normalizeToolInput(call.input)
  if (!product || !isRecord(input)) {
    return null
  }
  const node = outputNode(result)
  return product === 'jira' ? jiraReference(input, node) : confluenceReference(input, node)
}

/** The row's words for a Jira issue or Confluence page; null leaves the upstream wording. */
export function brzaAtlassianToolLineTitle(
  call: NativeChatToolCallBlock,
  result?: NativeChatToolResultBlock
): { target: string; title: string } | null {
  const reference = atlassianReference(call, result)
  return reference && { target: reference.target, title: reference.target }
}

export function brzaAtlassianChip(
  call: NativeChatToolCallBlock,
  result?: NativeChatToolResultBlock
): BrzaAtlassianChip | null {
  return atlassianReference(call, result)?.chip ?? null
}

/** The address a click opens: the target's own, else its path on the app's Jira site; null means copy only. */
export function brzaAtlassianChipUrl(
  target: BrzaAtlassianChipTarget,
  appJiraSiteUrl: string | null
): string | null {
  if (target.url) {
    return target.url
  }
  const site = appJiraSiteUrl ? httpUrl(appJiraSiteUrl) : null
  return site && target.sitePath
    ? `${site.origin}${site.pathname.replace(/\/+$/, '')}${target.sitePath}`
    : null
}
