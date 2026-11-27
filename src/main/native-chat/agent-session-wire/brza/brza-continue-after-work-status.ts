import type {
  AgentSessionStatusContinueAfterWork,
  BrzaContinueAfterWorkStatus
} from '../../../../shared/agent-session/brza/agent-session-status-continue-after-work'

/** A loaded chat, as the host holds it and the status summary reads it. */
export type BrzaContinueAfterWorkOwner = { readonly params: unknown }

/** Keyed by the loaded chat, so a closed or evicted chat takes its wait with it. */
export const brzaContinueAfterWorkStatuses = new WeakMap<
  BrzaContinueAfterWorkOwner,
  BrzaContinueAfterWorkStatus
>()

/** Spread into the status summary, as `accountSwitch` is. */
export function brzaContinueAfterWorkSummary(
  session: BrzaContinueAfterWorkOwner
): AgentSessionStatusContinueAfterWork {
  const status = brzaContinueAfterWorkStatuses.get(session)
  return status ? { brzaContinueAfterWork: status } : {}
}
