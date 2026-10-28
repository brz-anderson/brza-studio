import { nativeChatFullCommand } from '../native-chat-tool-input-text'
import type { NativeChatToolCallBlock, NativeChatToolResultBlock } from '../../../native-chat-types'
import { brzaToolCategory, type BrzaToolCategory } from './brza-tool-categories'
import { brzaShellSegments, type BrzaShellSegment } from './brza-shell-segments'
import { gitCommitHash, gitCommitSubject } from './brza-git-command'
import { ghReference } from './brza-gh-command'

export type BrzaToolLineChipTarget =
  | { kind: 'commit'; hash: string; subject: string | null }
  | { kind: 'url'; url: string }

/** A clickable reference beside the row's title; desktop only (R41.3). */
export type BrzaToolLineChip = { label: string; target: BrzaToolLineChipTarget }

const BRZA_COMMAND_CHIPS: Partial<
  Record<
    BrzaToolCategory,
    (
      segments: readonly BrzaShellSegment[],
      result: NativeChatToolResultBlock
    ) => BrzaToolLineChip | null
  >
> = {
  gh: (segments, result) => {
    const reference = ghReference(segments, result)
    return reference === null
      ? null
      : { label: `#${reference.number}`, target: { kind: 'url', url: reference.url } }
  },
  git: (segments, result) => {
    const hash = gitCommitHash(segments, result)
    if (hash === null) {
      return null
    }
    const subject = gitCommitSubject(segments, result)
    return { label: hash, target: { kind: 'commit', hash, subject } }
  }
}

/** The chip a call's output names, or null; it arrives with the result. */
export function brzaToolLineChip(
  call: NativeChatToolCallBlock,
  result?: NativeChatToolResultBlock
): BrzaToolLineChip | null {
  const category = brzaToolCategory(call.name, call.mcpIdentity, call.input)
  const chip = category === null ? undefined : BRZA_COMMAND_CHIPS[category]
  const command = nativeChatFullCommand(call.input)
  return chip && result && command !== null ? chip(brzaShellSegments(command), result) : null
}
