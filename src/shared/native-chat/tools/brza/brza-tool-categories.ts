/** BrzA tool categories refine the upstream ones for the glyph only (D37): upstream wording,
 * run sentences and command detection keep the call's upstream category. */
import { mcpToolIdentity, type NativeChatMcpIdentity } from '../native-chat-tool-identity'
import { isCommandToolName } from '../native-chat-tool-activity'
import { nativeChatFullCommand } from '../native-chat-tool-input-text'
import type { NativeChatToolCategoryCall } from '../native-chat-tool-icon'
import { parseOrcaBrowserCommand, runsOrcaCliCommand } from '../../../orca-browser-cli-commands'

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

/** Desktop-only logos; mobile draws BRZA_BRAND_LOGO_FALLBACK_ICONS (R29.4). Figma and Firebase stay
 * lucide (pen-tool, flame): their brand terms bar recolored in-product marks. Sources: renderer native-chat/brza/brza-brand-logos.md. */
export type BrzaBrandLogoIconName = 'git-logo' | 'github-logo' | 'jira-logo' | 'brza-logo'

export type BrzaToolIconName = BrzaLucideIconName | BrzaBrandLogoIconName

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
  /** Receives the display identity, e.g. `{ server: 'Plugin figma figma', tool: 'get screenshot' }`. */
  matchesMcpTool?: (identity: NativeChatMcpIdentity) => boolean
  /** Receives a command tool's full, login-shell-unwrapped command. */
  matchesCommand?: (command: string) => boolean
}

/** Register a category here: the row word, MCP tool or command that names it, and its icon. */
const BRZA_TOOL_CATEGORIES = [
  { category: 'skill', iconName: 'sparkles', rowWords: ['skill'] },
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
  {
    category: 'brzaCli',
    iconName: 'brza-logo',
    // `brza`, or `orca` on the terminal PATH; a browser command keeps the upstream globe.
    matchesCommand: (command) =>
      runsOrcaCliCommand(command) && parseOrcaBrowserCommand(command) === null
  }
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

/** Precedence mirrors upstream: MCP identity, then command input, then row word. */
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

  function definitionFor(
    rowWord: string,
    mcpIdentity?: NativeChatMcpIdentity,
    input?: unknown
  ): BrzaToolCategoryDefinition<Category> | null {
    const mcp = mcpDefinitions.length > 0 ? mcpToolIdentity(rowWord, mcpIdentity) : null
    if (mcp !== null) {
      return mcpDefinitions.find((definition) => definition.matchesMcpTool?.(mcp)) ?? null
    }
    if (commandDefinitions.length > 0 && isCommandToolName(rowWord)) {
      const command = nativeChatFullCommand(input)
      return command === null
        ? null
        : (commandDefinitions.find((definition) => definition.matchesCommand?.(command)) ?? null)
    }
    return byRowWord.get(rowWord.trim().toLowerCase()) ?? null
  }

  return {
    category: (rowWord, mcpIdentity, input) =>
      definitionFor(rowWord, mcpIdentity, input)?.category ?? null,
    iconName: (rowWord, mcpIdentity, input) =>
      definitionFor(rowWord, mcpIdentity, input)?.iconName ?? null,
    runIconName: (calls) => {
      let shared: BrzaToolCategoryDefinition<Category> | null = null
      for (const call of calls) {
        const definition = definitionFor(call.name, call.mcpIdentity, call.input)
        if (definition === null || (shared !== null && shared !== definition)) {
          return null
        }
        shared = definition
      }
      return shared?.iconName ?? null
    }
  }
}

export const {
  category: brzaToolCategory,
  iconName: brzaToolIconName,
  runIconName: brzaToolRunIconName
} = createBrzaToolCategoryResolver<BrzaToolCategory>(BRZA_TOOL_CATEGORIES)
