import type { AgentChildWorkView } from '../../../../shared/agent-status/child-work/agent-status-child-work-view'
import type { JournalWorkAnswer } from '../../agent-session-journal/journal-work-read'
import {
  structuredAgentSessionChildHasOpenWork,
  type StructuredAgentSessionChildWorkReads
} from '../termination/structured-agent-session-idle-sweep'

/** R4.1: a finished task whose wake-up has not started by now is carried in the continue. */
export const BRZA_CONTINUE_AFTER_WORK_WAKE_UP_GRACE_MS = 30_000

export type BrzaRetainedWork = StructuredAgentSessionChildWorkReads & {
  childWork: () => readonly AgentChildWorkView[] | undefined
}

/** The settled tasks the lead has not answered yet, the same test as the host's `owesWakeUp`;
 *  with no work read, every settled task. */
export function owedWakeUps(
  work: Pick<JournalWorkAnswer<'child-work'>, 'newestTurnCompletedAt'> | null,
  childWork: readonly AgentChildWorkView[] | undefined
): AgentChildWorkView[] {
  const ended = work?.newestTurnCompletedAt
  return (childWork ?? []).filter(
    (task) => task.settledAt !== undefined && (ended === undefined || task.settledAt > ended)
  )
}

/** When the finished tasks' wake-up is overdue; null while none is owed. */
export function brzaWakeUpDueAt(
  work: Pick<JournalWorkAnswer<'child-work'>, 'newestTurnCompletedAt'> | null,
  childWork: readonly AgentChildWorkView[] | undefined
): number | null {
  const owed = owedWakeUps(work, childWork)
  return owed.length === 0
    ? null
    : Math.max(...owed.map((task) => task.settledAt ?? 0)) +
        BRZA_CONTINUE_AFTER_WORK_WAKE_UP_GRACE_MS
}

/** The same, null too while other work is open. */
export async function brzaWakeUpDue(reads: BrzaRetainedWork): Promise<number | null> {
  const work = await reads.currentWork()
  return structuredAgentSessionChildHasOpenWork(reads, work)
    ? null
    : brzaWakeUpDueAt(work, reads.childWork())
}

const escaped = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** The notices the CLI would have handed the lead on its wake-up, in its own format (P1, F7). */
export function brzaTaskNotifications(tasks: readonly AgentChildWorkView[]): string {
  return tasks
    .map((task) => {
      const summary = [task.description ?? task.name, task.lastMessage].filter(Boolean).join(': ')
      return [
        '<task-notification>',
        `<task-id>${escaped(task.providerId ?? task.id)}</task-id>`,
        `<status>${escaped(task.outcome ?? task.state)}</status>`,
        ...(summary ? [`<summary>${escaped(summary)}</summary>`] : []),
        '</task-notification>'
      ].join('\n')
    })
    .join('\n')
}
