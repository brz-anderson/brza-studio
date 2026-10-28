import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getRuntimeGitCommitCompare } from '@/runtime/runtime-git-diff-client'
import { getConnectionId } from '@/lib/connection-context'
import {
  getWorktreeGitOwnerTarget,
  requireGitOwnerTarget
} from '@/components/right-sidebar/worktree-git-owner-target'
import type { NativeChatFileLinkContext } from '../native-chat-file-link'

/** Opens a commit's combined diff in the chat's worktree, as the history panel's row does (R38.1). */
export async function openCommitByHash(
  context: Pick<NativeChatFileLinkContext, 'worktreeId' | 'worktreePath'>,
  hash: string,
  subject?: string
): Promise<void> {
  const { worktreeId, worktreePath } = context
  const failed = translate(
    'auto.components.right.sidebar.SourceControl.8a5ba6a988',
    'Failed to load commit diff'
  )
  try {
    const result = await getRuntimeGitCommitCompare(
      {
        // Compare on the repo owner, which may differ from the focused host.
        target: requireGitOwnerTarget(getWorktreeGitOwnerTarget(worktreeId)),
        worktreeId,
        worktreePath,
        connectionId: getConnectionId(worktreeId) ?? undefined
      },
      hash
    )
    if (result.summary.status !== 'ready') {
      throw new Error(result.summary.errorMessage ?? failed)
    }
    useAppStore
      .getState()
      .openCommitAllDiffs(worktreeId, worktreePath, result.summary, result.entries, subject)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : failed)
  }
}
