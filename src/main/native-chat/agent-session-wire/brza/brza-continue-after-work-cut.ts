import type { AgentSessionJournal } from '../../agent-session-journal/journal-store'

const BRZA_CUT_GRACE_MS = 2_000

/** Why a wait ended without a continue, which the row says beside the button. */
export type BrzaContinueAfterWorkEnding = 'expired' | 'accountUnavailable' | 'turnFailed'

/** No cut once the work is done (PLN-026, A1). The wake-up went through on the old account, or a
 *  newer turn or another continue already takes the chat on: the wait ends quietly. A person's
 *  message meanwhile (R4.4) is answered on the old account first: it waits. A failed turn whose
 *  limit row has not landed yet: its publish checks again; with none after a grace, the turn
 *  failed for another reason, and the wait ends saying so. */
export async function brzaWithoutCut(input: {
  reads: Pick<AgentSessionJournal['reads'], 'newestTurn' | 'pendingSubmissions'> | undefined
  wait: { cutMissing?: { turnId: string; at: number } }
  now: number
  recheckAt: (when: number) => void
}): Promise<'drop' | 'wait' | 'turnFailed'> {
  const { reads, wait, now } = input
  if (!reads) {
    return 'drop'
  }
  const pending = await reads.pendingSubmissions()
  if (pending.some((submission) => submission.origin === 'client')) {
    return 'wait'
  }
  const turn = await reads.newestTurn()
  if (pending.length > 0 || turn?.state !== 'completed' || turn.outcome !== 'failure') {
    return 'drop'
  }
  // The grace belongs to this failed turn: a later one that fails starts its own.
  if (wait.cutMissing?.turnId !== turn.turnId) {
    wait.cutMissing = { turnId: turn.turnId, at: now }
    input.recheckAt(now + BRZA_CUT_GRACE_MS)
  }
  return now - wait.cutMissing.at >= BRZA_CUT_GRACE_MS ? 'turnFailed' : 'wait'
}
