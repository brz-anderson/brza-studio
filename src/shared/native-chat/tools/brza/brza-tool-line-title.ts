import { normalizeToolInput } from '../native-chat-tool-summary'
import { nativeChatFullCommand } from '../native-chat-tool-input-text'
import type { NativeChatToolCallBlock, NativeChatToolResultBlock } from '../../../native-chat-types'
import { brzaFigmaToolLineTitle } from './brza-figma-tool'
import { brzaToolCategory, type BrzaToolCategory } from './brza-tool-categories'
import { brzaShellSegments, type BrzaShellSegment } from './brza-shell-segments'
import { gitCommitSubject } from './brza-git-command'
import { ghReference, ghReferenceTitle } from './brza-gh-command'

type BrzaToolLineTitle = { target: string; title: string }

/** Input fields that name the thing a call works on, first match wins. */
const BRZA_TITLE_SUBJECTS: Partial<
  Record<BrzaToolCategory, { prefix: string; fields: readonly string[] }>
> = {
  skill: { prefix: 'Skill', fields: ['skill', 'name'] },
  firebase: {
    prefix: 'Firebase',
    fields: ['project_id', 'projectId', 'project', 'active_project']
  },
  context7: { prefix: 'Context7', fields: ['libraryName', 'libraryId'] }
}

/** A command's row text from its segments and output; null keeps the command (R40.2). */
const BRZA_COMMAND_TITLES: Partial<
  Record<
    BrzaToolCategory,
    (segments: readonly BrzaShellSegment[], result?: NativeChatToolResultBlock) => string | null
  >
> = {
  gh: (segments, result) => {
    const reference = ghReference(segments, result)
    return reference === null ? null : ghReferenceTitle(reference)
  },
  git: (segments, result) => {
    const subject = gitCommitSubject(segments, result)
    return subject === null ? null : `git commit — ${subject}`
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** The row's target and tooltip for a BrzA category; null leaves the upstream wording. */
export function brzaToolLineTitle(
  call: NativeChatToolCallBlock,
  result?: NativeChatToolResultBlock
): BrzaToolLineTitle | null {
  const category = brzaToolCategory(call.name, call.mcpIdentity, call.input)
  if (category === 'figma') {
    return brzaFigmaToolLineTitle(call, result)
  }
  const commandTitle = category === null ? undefined : BRZA_COMMAND_TITLES[category]
  if (commandTitle) {
    // The tooltip keeps the whole command the row no longer shows.
    const command = nativeChatFullCommand(call.input)
    const target = command === null ? null : commandTitle(brzaShellSegments(command), result)
    return command === null || target === null ? null : { target, title: command }
  }
  const subject = category === null ? undefined : BRZA_TITLE_SUBJECTS[category]
  const input = normalizeToolInput(call.input)
  if (!subject || !isRecord(input)) {
    return null
  }
  for (const field of subject.fields) {
    const value = input[field]
    const target = typeof value === 'string' ? value.trim().replace(/^\/+/, '') : ''
    if (target) {
      return { target, title: `${subject.prefix} · ${target}` }
    }
  }
  return null
}
