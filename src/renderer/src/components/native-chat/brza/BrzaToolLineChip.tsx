import { useContext, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { translate } from '@/i18n/i18n'
import type {
  NativeChatToolCallBlock,
  NativeChatToolResultBlock
} from '../../../../../shared/native-chat-types'
import {
  brzaToolLineChip,
  type BrzaToolLineChipTarget
} from '../../../../../shared/native-chat/tools/brza/brza-tool-line-chip'
import { useAppStore } from '@/store'
import { NativeChatMarkdownImageOwnerContext } from '../native-chat-markdown-image-owner'
import { resolveNativeChatHttpLinkRouting } from '../native-chat-link-target-actions'
import { openNativeChatWebLink } from '../native-chat-web-link-actions'
import type { NativeChatFileLinkContext } from '../native-chat-file-link'
import { openCommitByHash } from './brza-open-commit-by-hash'

const CHIP_CLASS = 'shrink-0 font-mono text-xs text-chat-foreground-faint'

function chipAction(target: BrzaToolLineChipTarget): string {
  switch (target.kind) {
    case 'commit':
      return translate('brza.native-chat.openCommitDiff', 'Open commit diff')
    case 'url':
      return target.url
  }
}

function openChip(target: BrzaToolLineChipTarget, context: NativeChatFileLinkContext): void {
  switch (target.kind) {
    case 'commit':
      void openCommitByHash(context, target.hash, target.subject ?? undefined)
      return
    case 'url': {
      // Read at click time, as chat links do: ownership must not re-render the transcript.
      const { sourceOwner } = resolveNativeChatHttpLinkRouting(
        useAppStore.getState(),
        context.worktreeId
      )
      openNativeChatWebLink(
        target.url,
        { worktreeId: context.worktreeId, sourceTabId: context.sourceTabId, sourceOwner },
        undefined
      )
    }
  }
}

/** The reference a call's output names, beside the row's title; opening it never toggles the row. */
export function BrzaToolLineChip({
  call,
  result
}: {
  call: NativeChatToolCallBlock
  result?: NativeChatToolResultBlock
}): React.JSX.Element | null {
  const context = useContext(NativeChatMarkdownImageOwnerContext)?.fileLinkContext
  const chip = useMemo(() => brzaToolLineChip(call, result), [call, result])
  if (!chip) {
    return null
  }
  if (!context) {
    return <span className={CHIP_CLASS}>{chip.label}</span>
  }
  const action = chipAction(chip.target)
  return (
    <span
      role="link"
      tabIndex={0}
      title={action}
      aria-label={`${action} ${chip.label}`}
      className={cn(
        CHIP_CLASS,
        'cursor-pointer rounded-sm underline-offset-2 transition-colors hover:text-chat-foreground-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      onClick={(event) => {
        // The row around this is its expand button; opening the reference must not also toggle it.
        event.stopPropagation()
        openChip(chip.target, context)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          event.stopPropagation()
          openChip(chip.target, context)
        }
      }}
    >
      {chip.label}
    </span>
  )
}
