import type { AgentSessionHistoryPage } from '../../shared/agent-session/agent-session-wire'

export function chatQueueHold(page: AgentSessionHistoryPage): 'question' | 'working' | null {
  if ((page.actionablePromptIds?.length ?? 0) > 0) {
    return 'question'
  }
  if (page.working === true) {
    return 'working'
  }
  if (page.actionablePromptIds === undefined) {
    const pendingPrompt =
      page.items?.some(
        (item) =>
          (item.body.kind === 'approval' || item.body.kind === 'question') &&
          item.body.resolution.state === 'pending'
      ) ?? false
    if (pendingPrompt) {
      return 'question'
    }
  }
  return null
}
