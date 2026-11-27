import type { AgentChildWorkView } from '../../../../shared/agent-status/child-work/agent-status-child-work-view'
import type { JournalWorkAnswer } from '../../agent-session-journal/journal-work-read'
import type { StructuredAgentSessionChildWorkReads } from '../termination/structured-agent-session-idle-sweep'

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
