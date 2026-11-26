import { useState, type RefObject } from 'react'
import type { Node } from '@tiptap/pm/model'
import type { Transaction } from '@tiptap/pm/state'
import {
  PLAIN_PROMPT_COORDINATES,
  type NativeChatPromptCoordinates
} from './native-chat-prompt-document'

/** `coordinates` names the text the offsets count in: plain, or the Markdown the composer's mode sends. */
export function createPromptTextPositionTracking(
  coordinates: () => NativeChatPromptCoordinates = () => PLAIN_PROMPT_COORDINATES
) {
  const positions = new Set<{ position: number; changed: (offset: number | null) => void }>()
  return {
    track(doc: Node, offset: number, changed: (offset: number | null) => void): () => void {
      const entry = { position: coordinates().position(doc, offset), changed }
      positions.add(entry)
      return () => positions.delete(entry)
    },
    apply(transactions: readonly Transaction[]): void {
      if (positions.size === 0) {
        return
      }
      const doc = transactions.at(-1)?.doc
      if (!doc || !transactions.some((transaction) => transaction.docChanged)) {
        return
      }
      for (const entry of positions) {
        let deleted = false
        for (const transaction of transactions) {
          const mapped = transaction.mapping.mapResult(entry.position, 1)
          entry.position = mapped.pos
          if (mapped.deleted) {
            deleted = true
            positions.delete(entry)
            break
          }
        }
        entry.changed(deleted ? null : coordinates().offset(doc, entry.position))
      }
    }
  }
}

/** Built once per editor, outside render: the tracking reads the coordinates the owner stores in the ref. */
function createFollowingTracking(): [
  ReturnType<typeof createPromptTextPositionTracking>,
  RefObject<NativeChatPromptCoordinates>
] {
  const coordinates: RefObject<NativeChatPromptCoordinates> = { current: PLAIN_PROMPT_COORDINATES }
  return [createPromptTextPositionTracking(() => coordinates.current), coordinates]
}

/** The tracking for one editor, and the ref its owner points at the mode's coordinates once it has them. */
export function usePromptTextPositionTracking(): [
  ReturnType<typeof createPromptTextPositionTracking>,
  RefObject<NativeChatPromptCoordinates>
] {
  const [tracking] = useState(createFollowingTracking)
  return tracking
}
