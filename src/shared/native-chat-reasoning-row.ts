// Derive reasoning disclosure/headlines from host start/end facts so desktop/mobile show the same lifecycle.

import { isRootAgentJournalItem } from './agent-session-journal-producer'
import { deriveNativeChatRowContent, nativeChatRowRendersContent } from './native-chat-row-content'
import { formatNativeChatDuration } from './native-chat-turn-status'
import type { NativeChatMessage } from './native-chat-types'

/** An open reasoning block and the text it has so far. */
export type NativeChatLiveReasoning = { message: NativeChatMessage; markdown: string }

/** Newest content of the live working turn must be an open reasoning block. Only nativeChatLiveLine consumes it,
 * so the block row hides exactly while the disclosing line draws. */
export function selectNativeChatLiveReasoning(
  messages: readonly NativeChatMessage[],
  inLiveWorkingTurn: (index: number) => boolean
): NativeChatLiveReasoning | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (!message || !inLiveWorkingTurn(index)) {
      continue
    }
    if (message.role === 'user') {
      return null
    }
    // A notice is not newer content, and a subagent's reasoning draws in its own section.
    if (message.role === 'system' || !isRootAgentJournalItem(message)) {
      continue
    }
    if (message.role !== 'reasoning') {
      if (!nativeChatRowRendersContent(message.blocks)) {
        continue
      }
      return null
    }
    // Not `=== 'running'`: a host that keeps no lifecycle gets the same single live slot.
    if (message.state === 'completed') {
      return null
    }
    const { markdown } = deriveNativeChatRowContent(message.blocks)
    return markdown.trim().length > 0 ? { message, markdown } : null
  }
  return null
}

/** One key per reasoning block, read by the live line and the finished row alike. */
export function nativeChatReasoningDisclosureKey(messageId: string): string {
  return `reasoning:${messageId}`
}

export type NativeChatReasoningHeadline =
  /** From a host that kept no lifecycle, or not yet ended: nothing is claimed. */
  | { kind: 'reasoning' }
  /** Ended, with no span the host saw. */
  | { kind: 'thought' }
  | { kind: 'thoughtFor'; duration: string }

/** `live`: the row is drawn inside its working turn or working subagent. */
export function nativeChatReasoningHeadline(
  message: Pick<NativeChatMessage, 'state' | 'completedAt' | 'timestamp'>,
  { live }: { live: boolean }
): NativeChatReasoningHeadline {
  // Not ended yet, so it claims no past tense.
  if (message.state === undefined || (live && message.state !== 'completed')) {
    return { kind: 'reasoning' }
  }
  // An open row in a turn that is no longer live ended unseen, so it claims no duration.
  if (
    message.state !== 'completed' ||
    message.completedAt === undefined ||
    message.timestamp === null
  ) {
    return { kind: 'thought' }
  }
  return {
    kind: 'thoughtFor',
    duration: formatNativeChatDuration(
      Math.max(1, (message.completedAt - message.timestamp) / 1000)
    )
  }
}

/** English copy for clients without a translation catalog; desktop translates the same three. */
const NATIVE_CHAT_REASONING_COPY = {
  reasoning: 'Reasoning',
  thought: 'Thought',
  thoughtFor: (duration: string) => `Thought for ${duration}`
} as const

export function nativeChatReasoningHeadlineText(headline: NativeChatReasoningHeadline): string {
  return headline.kind === 'thoughtFor'
    ? NATIVE_CHAT_REASONING_COPY.thoughtFor(headline.duration)
    : NATIVE_CHAT_REASONING_COPY[headline.kind]
}

/** The closed line's label: the headline ending on a colon, before the reasoning's start. */
export function nativeChatReasoningLabelText(headline: NativeChatReasoningHeadline): string {
  return `${nativeChatReasoningHeadlineText(headline)}:`
}

// The line shows one row of text, so only the start of a long block is worth stripping.
const NATIVE_CHAT_REASONING_PREVIEW_SOURCE_CHARS = 1_000

/** The reasoning as one line of running text: markup dropped, line breaks as spaces. */
export function nativeChatReasoningPreview(markdown: string): string {
  return markdown
    .slice(0, NATIVE_CHAT_REASONING_PREVIEW_SOURCE_CHARS)
    .replace(/^\s*(?:`{3,}|~{3,}).*$/gm, ' ')
    .replace(/^\s*([-*_])(?:\s*\1){2,}\s*$/gm, ' ')
    .replace(/^\s*(?:>\s?|#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)+/gm, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__|~~)(?=\S)(.+?)(?<=\S)\1/g, '$2')
    .replace(/(^|[^\w*])([*_])(?=\S)(.+?)(?<=\S)\2(?![\w*])/g, '$1$3')
    .replace(/\s+/g, ' ')
    .trim()
}
