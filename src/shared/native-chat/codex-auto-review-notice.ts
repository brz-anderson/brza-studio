import type { AgentJournalStatusItem } from '../agent-session-journal-types'

/** A successful auto-review is not a warning the person needs to act on. */
export function isCodexAutoReviewApprovedNotice(body: AgentJournalStatusItem): boolean {
  return (
    body.providerFrame?.provider === 'codex' &&
    body.providerFrame.kind === 'notification:guardianWarning' &&
    /^Automatic approval review approved\b/.test(body.text)
  )
}
