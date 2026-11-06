/** Upstream's warning texts with the product name; kept out of the resolution module, which sits
 *  at its line limit. */
export const LINEAGE_WARNING_MESSAGES = {
  envParentUnvalidated:
    'Worktree created, but BrzA Studio could not validate the environment parent context.',
  callerTerminalUnvalidated:
    'Worktree created, but BrzA Studio could not validate the caller terminal as a parent context.',
  cwdParentUnvalidated:
    'Worktree created, but BrzA Studio could not validate the current directory as a parent context.',
  parentConflict:
    'Worktree created, but BrzA Studio could not prove which parent context caused it.'
} as const
