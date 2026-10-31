/** BrzA tool categories refine the upstream ones for the glyph only (D37): upstream wording,
 * run sentences and command detection keep the call's upstream category. */
import { mcpToolIdentity, type NativeChatMcpIdentity } from '../native-chat-tool-identity'
import { isCommandToolName } from '../native-chat-tool-activity'
import { nativeChatFullCommand } from '../native-chat-tool-input-text'
import type { NativeChatToolCategoryCall } from '../native-chat-tool-icon'
import { parseOrcaBrowserCommand } from '../../../orca-browser-cli-commands'
import { BRZA_FIGMA_CATEGORY } from './brza-figma-tool'
import { BRZA_SHELL_CATEGORIES } from './brza-shell-categories'
import { brzaShellSegments, type BrzaShellSegment } from './brza-shell-segments'
import { BRZA_CONFLUENCE_CATEGORY, BRZA_JIRA_CATEGORY } from './brza-atlassian-tool'

/** Lucide ids D38/D39 name, plus brand fallbacks; each has a glyph in the desktop and mobile BrzA tables. */
export type BrzaLucideIconName =
  | 'git-branch'
  | 'git-commit-horizontal'
  | 'git-pull-request'
  | 'flask-conical'
  | 'package'
  | 'hammer'
  | 'sparkles'
  | 'flame'
  | 'book-open'
  | 'square-kanban'
  | 'pen-tool'
  | 'file-text'

/** Desktop-only logos; mobile draws BRZA_BRAND_LOGO_FALLBACK_ICONS (R29.4). Figma and Firebase stay
 * lucide (pen-tool, flame): their brand terms bar recolored in-product marks. Sources: renderer native-chat/brza/brza-brand-logos.md. */
export type BrzaBrandLogoIconName = 'git-logo' | 'github-logo' | 'jira-logo' | 'brza-logo'

/** Upstream ids a BrzA category reuses, such as Skill's plug; the upstream tables already draw them. */
export type BrzaUpstreamIconName = 'plug'

export type BrzaToolIconName = BrzaLucideIconName | BrzaBrandLogoIconName | BrzaUpstreamIconName

/** The ids the BrzA glyph tables draw. */
export type BrzaGlyphIconName = Exclude<BrzaToolIconName, BrzaUpstreamIconName>

export const BRZA_BRAND_LOGO_FALLBACK_ICONS: Record<BrzaBrandLogoIconName, BrzaLucideIconName> = {
  'git-logo': 'git-branch',
  'github-logo': 'git-pull-request',
  'jira-logo': 'square-kanban',
  'brza-logo': 'flame'
}

export type BrzaToolCategoryDefinition<Category extends string = string> = {
  category: Category
  iconName: BrzaToolIconName
  /** Row words (tool names) the lane renders, matched trimmed and lowercased. */
  rowWords?: readonly string[]
  /**
   * Receives the display identity, e.g. `{ server: 'Plugin figma figma', tool: 'get screenshot' }`, and
   * the call's input, for a server whose meta-tools name the real tool there.
   */
  matchesMcpTool?: (identity: NativeChatMcpIdentity, input?: unknown) => boolean
  /** Receives each segment of a command tool's full, login-shell-unwrapped command. */
  matchesCommand?: (segment: BrzaShellSegment) => boolean
  /** A matched segment's own icon, such as `git commit`'s; null keeps `iconName`. */
  segmentIconName?: (segment: BrzaShellSegment) => BrzaToolIconName | null
}

/** Register a category here: the row word, MCP tool or command that names it, and its icon. */
const BRZA_TOOL_CATEGORIES = [
  { category: 'skill', iconName: 'plug', rowWords: ['skill'] },
  BRZA_FIGMA_CATEGORY,
  BRZA_JIRA_CATEGORY,
  BRZA_CONFLUENCE_CATEGORY,
  {
    category: 'firebase',
    iconName: 'flame',
    matchesMcpTool: ({ server }) => /firebase/i.test(server)
  },
  {
    category: 'context7',
    iconName: 'book-open',
    matchesMcpTool: ({ server }) => /context7/i.test(server)
  },
  ...BRZA_SHELL_CATEGORIES
] as const satisfies readonly BrzaToolCategoryDefinition[]

export type BrzaToolCategory = (typeof BRZA_TOOL_CATEGORIES)[number]['category']

export type BrzaToolCategoryResolver<Category extends string> = {
  category: (
    rowWord: string,
    mcpIdentity?: NativeChatMcpIdentity,
    input?: unknown
  ) => Category | null
  iconName: (
    rowWord: string,
    mcpIdentity?: NativeChatMcpIdentity,
    input?: unknown
  ) => BrzaToolIconName | null
  runIconName: (calls: readonly NativeChatToolCategoryCall[]) => BrzaToolIconName | null
}

type BrzaToolCategoryMatch<Category extends string> = {
  definition: BrzaToolCategoryDefinition<Category>
  iconName: BrzaToolIconName
}

/** Precedence mirrors upstream: MCP identity, then command input, then row word. Command
 * definitions weigh by their order, the first one any segment matches winning. */
export function createBrzaToolCategoryResolver<Category extends string>(
  definitions: readonly BrzaToolCategoryDefinition<Category>[]
): BrzaToolCategoryResolver<Category> {
  // Map avoids truthy inherited object keys such as __proto__.
  const byRowWord = new Map<string, BrzaToolCategoryDefinition<Category>>()
  for (const definition of definitions) {
    for (const word of definition.rowWords ?? []) {
      byRowWord.set(word.trim().toLowerCase(), definition)
    }
  }
  const mcpDefinitions = definitions.filter((definition) => definition.matchesMcpTool)
  const commandDefinitions = definitions.filter((definition) => definition.matchesCommand)

  function commandMatch(command: string): BrzaToolCategoryMatch<Category> | null {
    // A browser command keeps the upstream globe (R41.1).
    if (parseOrcaBrowserCommand(command) !== null) {
      return null
    }
    const segments = brzaShellSegments(command)
    for (const definition of commandDefinitions) {
      const matched = segments.filter((segment) => definition.matchesCommand?.(segment))
      if (matched.length > 0) {
        const refined = matched
          .map((segment) => definition.segmentIconName?.(segment) ?? null)
          .find((iconName) => iconName !== null)
        return { definition, iconName: refined ?? definition.iconName }
      }
    }
    return null
  }

  function match(
    rowWord: string,
    mcpIdentity?: NativeChatMcpIdentity,
    input?: unknown
  ): BrzaToolCategoryMatch<Category> | null {
    const mcp = mcpDefinitions.length > 0 ? mcpToolIdentity(rowWord, mcpIdentity) : null
    if (mcp !== null) {
      const definition = mcpDefinitions.find((candidate) => candidate.matchesMcpTool?.(mcp, input))
      return definition ? { definition, iconName: definition.iconName } : null
    }
    if (commandDefinitions.length > 0 && isCommandToolName(rowWord)) {
      const command = nativeChatFullCommand(input)
      return command === null ? null : commandMatch(command)
    }
    const definition = byRowWord.get(rowWord.trim().toLowerCase())
    return definition ? { definition, iconName: definition.iconName } : null
  }

  return {
    category: (rowWord, mcpIdentity, input) =>
      match(rowWord, mcpIdentity, input)?.definition.category ?? null,
    iconName: (rowWord, mcpIdentity, input) => match(rowWord, mcpIdentity, input)?.iconName ?? null,
    // A run shares a category's icon; a refined one only when every call has it (R41.2).
    runIconName: (calls) => {
      let shared: BrzaToolCategoryMatch<Category> | null = null
      let sameIcon = true
      for (const call of calls) {
        const found = match(call.name, call.mcpIdentity, call.input)
        if (found === null || (shared !== null && shared.definition !== found.definition)) {
          return null
        }
        sameIcon &&= shared === null || shared.iconName === found.iconName
        shared = found
      }
      if (shared === null) {
        return null
      }
      return sameIcon ? shared.iconName : shared.definition.iconName
    }
  }
}

export const {
  category: brzaToolCategory,
  iconName: brzaToolIconName,
  runIconName: brzaToolRunIconName
} = createBrzaToolCategoryResolver<BrzaToolCategory>(BRZA_TOOL_CATEGORIES)
